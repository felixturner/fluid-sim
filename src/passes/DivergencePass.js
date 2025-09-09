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

export class DivergencePass {
  constructor() {
    this.scene = new Scene();

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)
    );
    this.material = new RawShaderMaterial({
      uniforms: {
        timeDelta: new Uniform(0.0),
        velocity: new Uniform(null),
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
          uniform float timeDelta;
          uniform sampler2D velocity;
          uniform vec2 texelSize;
         
          void main() {
            float x0 = texture2D(velocity, vUV - vec2(texelSize.x, 0.0)).x;
            float x1 = texture2D(velocity, vUV + vec2(texelSize.x, 0.0)).x;
            float y0 = texture2D(velocity, vUV - vec2(0.0, texelSize.y)).y;
            float y1 = texture2D(velocity, vUV + vec2(0.0, texelSize.y)).y;
            float divergence = (x1 - x0 + y1 - y0) * 0.5;
            
            gl_FragColor = vec4(divergence);
          }`,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false; // Just here to silence a console error.
    this.scene.add(this.mesh);
  }

  update(uniforms) {
    if (uniforms.timeDelta !== undefined) {
      this.material.uniforms.timeDelta.value = uniforms.timeDelta;
    }
    if (uniforms.density !== undefined) {
      this.material.uniforms.density.value = uniforms.density;
    }
    if (uniforms.velocity !== undefined) {
      this.material.uniforms.velocity.value = uniforms.velocity;
    }
    if (uniforms.resolution !== undefined) {
      this.material.uniforms.texelSize.value.set(
        1.0 / uniforms.resolution.x,
        1.0 / uniforms.resolution.y
      );
    }
  }
}
