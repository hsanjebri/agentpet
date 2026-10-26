// nowplaying: tells AgentPet what music is playing on this PC, using the Windows media session
// API (the same sessions as the media flyout: Spotify, browsers, Deezer, Apple Music...).
//
//   stdout: one JSON line whenever the state changes, checked about once a second
//           {"playing":true,"title":"...","artist":"...","app":"Spotify","hasSession":true}
//           plus "thumb" (small base64 PNG) on the line where the track changes
//   stdin:  one command per line: toggle | next | prev
//
// It never crashes: every error is swallowed and reported as {"hasSession":false}.
// It exits when stdin closes (AgentPet quit or was killed).
using System.Text;
using System.Text.Json;
using Windows.Graphics.Imaging;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Session = Windows.Media.Control.GlobalSystemMediaTransportControlsSession;
using Status = Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus;

Console.OutputEncoding = new UTF8Encoding(false);
Console.InputEncoding = new UTF8Encoding(false);

GlobalSystemMediaTransportControlsSessionManager? manager = null;
Session? current = null; // the session commands go to
string? followed = null; // app we're following, so a track change doesn't jump to another app
string? lastLine = null;
string? lastTrack = null;
var gate = new SemaphoreSlim(1, 1); // commands and polling don't run at the same time

// stdin: commands; end of input = parent is gone
_ = Task.Run(async () =>
{
    try
    {
        string? line;
        while ((line = Console.ReadLine()) != null) await RunCommand(line.Trim().ToLowerInvariant());
    }
    catch { }
    Environment.Exit(0);
});

while (true)
{
    await gate.WaitAsync();
    try
    {
        await Poll();
    }
    catch
    {
        Emit(new { hasSession = false }, null);
    }
    finally
    {
        gate.Release();
    }
    await Task.Delay(1000);
}

async Task Poll()
{
    manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    current = PickSession(manager);
    if (current is null)
    {
        Emit(new { hasSession = false }, null);
        return;
    }

    var info = current.GetPlaybackInfo();
    var props = await current.TryGetMediaPropertiesAsync();
    var title = props?.Title ?? "";
    var artist = props?.Artist ?? "";
    var state = new
    {
        playing = info?.PlaybackStatus == Status.Playing,
        title,
        artist,
        app = FriendlyApp(current.SourceAppUserModelId),
        hasSession = true
    };

    var track = $"{state.app}\n{title}\n{artist}";
    string? thumb = null;
    if (track != lastTrack && title != "")
    {
        lastTrack = track;
        thumb = await Thumbnail(props?.Thumbnail);
        lastLine = null; // a new track always gets a line (with its thumbnail)
    }
    Emit(state, thumb);
}

// Prefer a session that is playing (Spotify first if several). If nothing is playing, stay with
// the app we were following (it's probably just switching tracks), else the system's current one.
Session? PickSession(GlobalSystemMediaTransportControlsSessionManager m)
{
    var sessions = m.GetSessions();
    var playing = sessions.Where(s => s.GetPlaybackInfo()?.PlaybackStatus == Status.Playing).ToList();
    var pick = playing.Count > 0
        ? playing.FirstOrDefault(s => s.SourceAppUserModelId.Contains("spotify", StringComparison.OrdinalIgnoreCase))
          ?? playing.FirstOrDefault(s => s.SourceAppUserModelId == followed)
          ?? playing[0]
        // two browser tabs share one app id: the one switching tracks says "Changing", not "Paused"
        : sessions
              .Where(s => s.SourceAppUserModelId == followed)
              .OrderByDescending(s => s.GetPlaybackInfo()?.PlaybackStatus == Status.Changing)
              .FirstOrDefault()
          ?? m.GetCurrentSession();
    followed = pick?.SourceAppUserModelId;
    return pick;
}

async Task RunCommand(string command)
{
    await gate.WaitAsync();
    try
    {
        var session = current ?? (manager is null ? null : PickSession(manager));
        if (session is null) return;
        _ = command switch
        {
            "toggle" => await session.TryTogglePlayPauseAsync(),
            "next" => await session.TrySkipNextAsync(),
            "prev" => await session.TrySkipPreviousAsync(),
            _ => false
        };
    }
    catch { }
    finally
    {
        gate.Release();
    }
}

// Prints the state only when it changed since the last line.
void Emit(object state, string? thumb)
{
    var line = JsonSerializer.Serialize(state);
    if (line == lastLine && thumb is null) return;
    lastLine = line;
    if (thumb is not null) line = line[..^1] + $",\"thumb\":\"{thumb}\"}}";
    Console.WriteLine(line);
    Console.Out.Flush();
}

// "Spotify.exe", "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", "MSEdge"... -> a readable name.
static string FriendlyApp(string id)
{
    var known = new (string Part, string Name)[]
    {
        ("spotify", "Spotify"), ("chrome", "Chrome"), ("msedge", "Edge"), ("firefox", "Firefox"),
        ("opera", "Opera"), ("brave", "Brave"), ("deezer", "Deezer"), ("applemusic", "Apple Music"),
        ("itunes", "iTunes"), ("zunemusic", "Media Player"), ("vlc", "VLC"), ("tidal", "TIDAL"),
        ("youtube", "YouTube Music"), ("soundcloud", "SoundCloud")
    };
    foreach (var (part, name) in known)
        if (id.Contains(part, StringComparison.OrdinalIgnoreCase)) return name;
    var name2 = id.Split('!').Last();
    return name2.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? name2[..^4] : name2;
}

// Album art as a small (64 px) base64 PNG, or null.
static async Task<string?> Thumbnail(IRandomAccessStreamReference? reference)
{
    if (reference is null) return null;
    try
    {
        using var source = await reference.OpenReadAsync();
        var decoder = await BitmapDecoder.CreateAsync(source);
        using var output = new InMemoryRandomAccessStream();
        var encoder = await BitmapEncoder.CreateForTranscodingAsync(output, decoder);
        encoder.BitmapTransform.ScaledWidth = 64;
        encoder.BitmapTransform.ScaledHeight = 64;
        encoder.BitmapTransform.InterpolationMode = BitmapInterpolationMode.Fant;
        await encoder.FlushAsync();

        // re-encode as PNG (the source is often a JPEG)
        var pixels = await BitmapDecoder.CreateAsync(output);
        var bitmap = await pixels.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
        using var png = new InMemoryRandomAccessStream();
        var pngEncoder = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, png);
        pngEncoder.SetSoftwareBitmap(bitmap);
        await pngEncoder.FlushAsync();

        var bytes = new byte[png.Size];
        using var reader = new DataReader(png.GetInputStreamAt(0));
        await reader.LoadAsync((uint)png.Size);
        reader.ReadBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
    catch
    {
        return null;
    }
}
