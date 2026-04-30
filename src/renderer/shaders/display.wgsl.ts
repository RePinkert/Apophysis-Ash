export const DISPLAY_SHADER_VERT = /* wgsl */`

@vertex
fn main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
  );
  return vec4f(pos[vi], 0.0, 1.0);
}
`

export const DISPLAY_SHADER_FRAG = /* wgsl */`

@group(0) @binding(0) var tex_sampler: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let dims = textureDimensions(tex);
  let uv = vec2f(pos.x / f32(dims.x), pos.y / f32(dims.y));
  return textureSample(tex, tex_sampler, uv);
}
`
