/** True when the server reset marker is ahead of the copy stored on this device. */
export function progressGenerationIsNewer(server: number | null, local: number): boolean {
  return server != null && Number.isFinite(server) && server > local
}
