struct CameraUniform {
  viewProjection: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * vec4<f32>(input.position, 0.0, 1.0);
  output.uv = input.uv;
  output.color = input.color;
  return output;
}

fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let msdf = textureSample(texTexture, texSampler, input.uv);
  let sd = median(msdf.r, msdf.g, msdf.b);

  // color.a > 1.0 signals stroke mode — extra value is stroke expansion in px
  let strokeExpand = max(input.color.a - 1.0, 0.0);
  let actualAlpha = select(input.color.a, 1.0, input.color.a > 1.0);

  let screenPxDistance = 6.0 * (sd - 0.5) + strokeExpand;
  let alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
  if (alpha < 0.01) { discard; }
  return vec4<f32>(input.color.rgb, actualAlpha * alpha);
}
