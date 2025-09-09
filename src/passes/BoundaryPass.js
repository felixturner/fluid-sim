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

export class BoundaryPass {
  constructor() {
    this.scene = new Scene();

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)
    );
    this.material = new RawShaderMaterial({
      uniforms: {
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
        uniform sampler2D velocity;
        uniform vec2 texelSize;

        void main() {
          float leftEdgeMask = ceil(texelSize.x - vUV.x);
          float bottomEdgeMask = ceil(texelSize.y - vUV.y);
          float rightEdgeMask = ceil(vUV.x - (1.0 - texelSize.x));
          float topEdgeMask = ceil(vUV.y - (1.0 - texelSize.y));
          float mask = clamp(leftEdgeMask + bottomEdgeMask + rightEdgeMask + topEdgeMask, 0.0, 1.0);
          float direction = mix(1.0, -1.0, mask);
          
          gl_FragColor = texture2D(velocity, vUV) * direction;
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false; // Just here to silence a console error.
    this.scene.add(this.mesh);
  }

  update(uniforms) {
    if (uniforms.position !== undefined) {
      this.material.uniforms.position.value = uniforms.position;
    }
    if (uniforms.direction !== undefined) {
      this.material.uniforms.direction.value = uniforms.direction;
    }
    if (uniforms.radius !== undefined) {
      this.material.uniforms.radius.value = uniforms.radius;
    }
    if (uniforms.velocity !== undefined) {
      this.material.uniforms.velocity.value = uniforms.velocity;
    }
    if (uniforms.resolution !== undefined) {
      this.material.uniforms.texelSize.value.set(
        1.0 / uniforms.resolution.x,
        1.0 / uniforms.resolution.y
      );

      //console.log('texelSize:', this.material.uniforms.texelSize.value);
    }
  }
}
