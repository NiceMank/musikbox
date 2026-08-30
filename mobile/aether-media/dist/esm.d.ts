export interface AetherAudioItem {
  key: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // ms
  size: number;
  mimeType: string;
}
export interface AetherMediaPlugin {
  checkPermission(): Promise<{ granted: boolean; alias?: string; unsupported?: boolean }>;
  requestPermission(): Promise<{ granted: boolean; alias?: string; unsupported?: boolean }>;
  getAudio(): Promise<{ items: AetherAudioItem[]; denied?: boolean; unsupported?: boolean }>;
}
declare const AetherMedia: AetherMediaPlugin;
export default AetherMedia;
