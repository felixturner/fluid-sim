import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  RawShaderMaterial,
  Scene,
  Texture,
  Uniform,
  Vector2,
  Float32BufferAttribute,
} from 'three';

export class JacobiIterationsPass {
  constructor() {
    this.scene = new Scene();

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)
    );
    this.material = new RawShaderMaterial({
      uniforms: {
        alpha: new Uniform(-1.0), // TODO: Configure this parameters accordingly!
        beta: new Uniform(0.25),
        previousIteration: new Uniform(null),
        divergence: new Uniform(null),
        texelSize: new Uniform(new Vector2(1.0 / 512.0, 1.0 / 512.0)),
      },
      vertexShader: `
            attribute vec2 position;
            varying vec2 vUV;
    
            void main() {
              vUV = position * 0.5 + 0.5;
              gl_Position = vec4(position, 0.0, 1.0);
            }`,
      fragmentShader: `
            precision highp float;
            precision highp int;
            varying vec2 vUV;
            uniform float alpha;
            uniform float beta;
            uniform sampler2D previousIteration;
            uniform sampler2D divergence;
            uniform vec2 texelSize;
    
            void main() {
              vec4 x0 = texture2D(previousIteration, vUV - vec2(texelSize.x, 0.0));
              vec4 x1 = texture2D(previousIteration, vUV + vec2(texelSize.x, 0.0));
              vec4 y0 = texture2D(previousIteration, vUV - vec2(0.0, texelSize.y));
              vec4 y1 = texture2D(previousIteration, vUV + vec2(0.0, texelSize.y));
              vec4 d = texture2D(divergence, vUV);

              gl_FragColor = (x0 + x1 + y0 + y1 + alpha * d) * beta;
            }`,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false; // Just here to silence a console error.
    this.scene.add(this.mesh);
  }

  update(uniforms) {
    if (uniforms.previousIteration !== undefined) {
      this.material.uniforms.previousIteration.value =
        uniforms.previousIteration;
    }
    if (uniforms.divergence !== undefined) {
      this.material.uniforms.divergence.value = uniforms.divergence;
    }
    if (uniforms.resolution !== undefined) {
      this.material.uniforms.texelSize.value.set(
        1.0 / uniforms.resolution.x,
        1.0 / uniforms.resolution.y
      );
    }
  }
}
