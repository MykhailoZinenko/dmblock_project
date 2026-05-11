struct CameraUniform {
  viewProjection: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) corner: vec2<f32>,
  @location(1) pos: vec2<f32>,
  @location(2) scaleRot: vec4<f32>,
  @location(3) tint: vec4<f32>,
  @location(4) uvFrame: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) tint: vec4<f32>,
};

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  let sx = input.scaleRot.x;
  let sy = input.scaleRot.y;
  let sinR = input.scaleRot.z;
  let cosR = input.scaleRot.w;

  let scaled = vec2<f32>(input.corner.x * sx, input.corner.y * sy);
  let rotated = vec2<f32>(
    scaled.x * cosR - scaled.y * sinR,
    scaled.x * sinR + scaled.y * cosR,
  );
  let worldPos = rotated + input.pos;

  var output: VertexOutput;
  output.position = camera.viewProjection * vec4<f32>(worldPos, 0.0, 1.0);

  let uvLerp = input.corner + vec2<f32>(0.5, 0.5);
  output.uv = mix(input.uvFrame.xy, input.uvFrame.zw, uvLerp);

  output.tint = input.tint;
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(texTexture, texSampler, input.uv);
  let result = color * input.tint;
  if (result.a < 0.01) { discard; }
  return result;
}
