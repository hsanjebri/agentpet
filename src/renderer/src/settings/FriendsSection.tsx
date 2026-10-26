// Settings › Friends (built in the Friends milestone).
import type { PetSettings } from '@shared/ipc'
import { Section } from './controls'

export function FriendsSection({ settings }: { settings: PetSettings }): React.JSX.Element {
  return <Section title="👥 Friends">{settings.friends ? 'On' : 'Coming soon.'}</Section>
}
