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
  })
  if (!adapter) return null

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
      maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
    },
  })

  const adapterInfo = adapter.info ?? { vendor: 'Unknown', architecture: '', device: '', description: '' }
  const deviceInfo = `${adapterInfo.vendor} - ${adapterInfo.architecture} - ${adapterInfo.device} (${adapterInfo.description})`

  return { adapter, device, info: deviceInfo }
}
