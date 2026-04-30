export function isWebGPUSupported(): boolean {
  return !!navigator.gpu
}

export async function initWebGPU(): Promise<{
  adapter: GPUAdapter
  device: GPUDevice
  info: string
} | null> {
  if (!navigator.gpu) return null

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
    forceFallbackAdapter: false,
  })
  if (!adapter) return null

  const adapterInfo = adapter.info ?? { vendor: 'Unknown', architecture: '', device: '', description: '' }
  console.log(`[WebGPU] Adapter: ${adapterInfo.vendor} - ${adapterInfo.architecture} - ${adapterInfo.device} (${adapterInfo.description})`)

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
      maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
    },
  })

  const deviceInfo = `${adapterInfo.vendor} - ${adapterInfo.architecture} - ${adapterInfo.device} (${adapterInfo.description})`

  return { adapter, device, info: deviceInfo }
}
