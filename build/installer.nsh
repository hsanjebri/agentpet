; Extra steps for the Windows installer (electron-builder NSIS).

; Before the files are removed: take AgentPet's hooks and status line out of Claude Code's
; settings (and restore the user's own status line), so Claude Code keeps working cleanly.
; Skipped when the "uninstall" is really an update (the new version keeps the hooks).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\AgentPet.exe" --disconnect-claude'
  ${endIf}
!macroend
