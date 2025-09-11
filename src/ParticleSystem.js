import {
  BufferAttribute,
  BufferGeometry,
  Points,
  RawShaderMaterial,
  Texture,
  Uniform,
  Vector2,
  Vector3,
  Float32BufferAttribute,
  AdditiveBlending,
  Scene,
} from 'three';

export class ParticleSystem {
  constructor(
    particleCount = 10000,
    bounds = { width: 1, height: 1 },
    gui = null
  ) {
    this.particleCount = particleCount;
    this.bounds = bounds;
    this.time = 0;

    // Particle system configuration
    this.config = {
      ShowParticles: true,
      ParticleCount: particleCount,
      ParticleSize: 6.0,
      ParticleBoundaries: false,
      ParticleSpeed: 0.2,
      ParticleColors: false,
    };

    // Create scene
    this.scene = new Scene();

    // Create geometry with particle positions and velocities
    this.geometry = new BufferGeometry();

    // Initialize particle positions randomly within bounds
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 2);
    const lifetimes = new Float32Array(particleCount);
    const randomSeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const i2 = i * 2;

      // Random position within bounds
      positions[i3] = (Math.random() - 0.5) * bounds.width;
      positions[i3 + 1] = (Math.random() - 0.5) * bounds.height;
      positions[i3 + 2] = 0;

      // Initial velocity
      velocities[i2] = 0;
      velocities[i2 + 1] = 0;

      // Random lifetime
      lifetimes[i] = Math.random() * 10 + 5; // 5-15 seconds

      // Random seed for flickering
      randomSeeds[i] = Math.random() * 1000.0;
    }

    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute(positions, 3)
    );
    this.geometry.setAttribute(
      'velocity',
      new Float32BufferAttribute(velocities, 2)
    );
    this.geometry.setAttribute(
      'lifetime',
      new Float32BufferAttribute(lifetimes, 1)
    );
    this.geometry.setAttribute(
      'randomSeed',
      new Float32BufferAttribute(randomSeeds, 1)
    );

    // Create material
    this.material = new RawShaderMaterial({
      uniforms: {
        time: new Uniform(0.0),
        velocityTexture: new Uniform(null),
        colorTexture: new Uniform(null),
        bounds: new Uniform(new Vector2(bounds.width, bounds.height)),
        particleSize: new Uniform(6.0),
        deltaTime: new Uniform(1.0 / 60.0),
        useBoundaries: new Uniform(1.0),
        particleSpeed: new Uniform(0.2),
        useColors: new Uniform(1.0),
      },
      vertexShader: /* glsl */ `
        attribute vec3 position;
        attribute vec2 velocity;
        attribute float lifetime;
        attribute float randomSeed;
        
        uniform float time;
        uniform sampler2D velocityTexture;
        uniform sampler2D colorTexture;
        uniform vec2 bounds;
        uniform float particleSize;
        uniform float deltaTime;
        uniform float useBoundaries;
        uniform float particleSpeed;
        uniform float useColors;
        
        varying float vAlpha;
        varying vec3 vColor;
        varying float vFlicker;
        
        void main() {
          vec3 pos = position;
          
          // Convert position to UV coordinates for velocity texture sampling
          vec2 uv = (pos.xy / bounds) + 0.5;
          
          // Sample velocity from fluid simulation
          vec2 fluidVelocity = texture2D(velocityTexture, uv).xy;
          
          // Sample color from fluid simulation or use white
          if (useColors > 0.5) {
            vec3 fluidColor = texture2D(colorTexture, uv).rgb;
            vColor = fluidColor;
          } else {
            vColor = vec3(1.0, 1.0, 1.0);
          }
          
          // Update particle position based on fluid velocity
          pos.xy += fluidVelocity * deltaTime * 50.0 * particleSpeed; // Scale factor for visible movement
          
          // Handle boundaries based on useBoundaries uniform
          // if (useBoundaries > 0.5) {
          //   // Wrap particles around bounds
          //   if (pos.x > bounds.x * 0.5) pos.x = -bounds.x * 0.5;
          //   if (pos.x < -bounds.x * 0.5) pos.x = bounds.x * 0.5;
          //   if (pos.y > bounds.y * 0.5) pos.y = -bounds.y * 0.5;
          //   if (pos.y < -bounds.y * 0.5) pos.y = bounds.y * 0.5;
          // } else {
          //   // When boundaries are off, hide particles that go out of bounds
          //   // They will be reset by CPU when their lifetime expires
          //   if (pos.x > bounds.x * 0.5 || pos.x < -bounds.x * 0.5 ||
          //       pos.y > bounds.y * 0.5 || pos.y < -bounds.y * 0.5) {
          //     // Move particle off-screen to hide it
          //     pos.xy = vec2(999.0, 999.0);
          //   }
          // }
          
          // Calculate alpha based on velocity magnitude
          float velocityMagnitude = length(fluidVelocity);
          vAlpha = clamp(velocityMagnitude * 2.0 - 0.4, 0., 1.0);
          
          // Calculate flicker effect using random seed and time
          float flickerFreq = 2.0 + randomSeed * 0.01; // Vary frequency per particle
          vFlicker =  sin(time * flickerFreq + randomSeed) /2. + 0.5;
          
          gl_Position = vec4(pos, 1.0);
          gl_PointSize = particleSize * (1.0 + velocityMagnitude * 2.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        varying float vAlpha;
        varying vec3 vColor;
        varying float vFlicker;
        
        void main() {
          // Create circular particles
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // Smooth falloff with flicker effect
          float alpha = (1.0 - dist * 2.0) * vAlpha * vFlicker;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    // Create points mesh
    this.points = new Points(this.geometry, this.material);
    this.scene.add(this.points);

    // Setup GUI if provided
    if (gui) {
      this.setupGUI(gui);
    }
  }

  update(
    deltaTime,
    velocityTexture,
    colorTexture,
    useBoundaries = true,
    particleSpeed = 1.0,
    useColors = true
  ) {
    this.time += deltaTime;
    this.material.uniforms.time.value = this.time;
    this.material.uniforms.deltaTime.value = deltaTime;
    this.material.uniforms.useBoundaries.value = useBoundaries ? 1.0 : 0.0;
    this.material.uniforms.particleSpeed.value = particleSpeed;
    this.material.uniforms.useColors.value = useColors ? 1.0 : 0.0;

    if (velocityTexture) {
      this.material.uniforms.velocityTexture.value = velocityTexture;
    }

    if (colorTexture) {
      this.material.uniforms.colorTexture.value = colorTexture;
    }

    // Update particle lifetimes and handle resets on CPU
    this.updateParticleLifetimes(deltaTime, useBoundaries);
  }

  updateParticleLifetimes(deltaTime, useBoundaries = true) {
    const positions = this.geometry.attributes.position;
    const lifetimes = this.geometry.attributes.lifetime;
    const randomSeeds = this.geometry.attributes.randomSeed;

    // Handle particle lifetime and reset logic
    // Note: Position movement is handled entirely in the vertex shader
    let needsUpdate = false;

    for (let i = 0; i < this.particleCount; i++) {
      lifetimes.array[i] -= deltaTime;
      const i3 = i * 3;

      // Check if particle needs to be reset due to lifetime expiration
      let shouldReset = lifetimes.array[i] <= 0;

      // For boundary checking, we need to calculate the current GPU position
      // This is approximate since the actual movement happens in the shader
      if (!useBoundaries && !shouldReset) {
        // We can't perfectly track GPU-moved positions on CPU
        // So we'll rely primarily on lifetime for resets when boundaries are off
        // The shader handles boundary wrapping when boundaries are on
      }

      if (shouldReset) {
        // Reset particle to random starting position
        positions.array[i3] = (Math.random() - 0.5) * this.bounds.width;
        positions.array[i3 + 1] = (Math.random() - 0.5) * this.bounds.height;
        lifetimes.array[i] = Math.random() * 10 + 5;
        randomSeeds.array[i] = Math.random() * 1000.0;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      positions.needsUpdate = true;
      lifetimes.needsUpdate = true;
      randomSeeds.needsUpdate = true;
    }
  }

  setParticleCount(count) {
    this.particleCount = count;
    this.config.ParticleCount = count;

    // Dispose of old geometry and material
    this.geometry.dispose();

    // Recreate geometry with new particle count
    this.geometry = new BufferGeometry();

    // Initialize particle positions randomly within bounds
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2);
    const lifetimes = new Float32Array(count);
    const randomSeeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i2 = i * 2;

      // Random position within bounds
      positions[i3] = (Math.random() - 0.5) * this.bounds.width;
      positions[i3 + 1] = (Math.random() - 0.5) * this.bounds.height;
      positions[i3 + 2] = 0;

      // Initial velocity
      velocities[i2] = 0;
      velocities[i2 + 1] = 0;

      // Random lifetime
      lifetimes[i] = Math.random() * 10 + 5; // 5-15 seconds

      // Random seed for flickering
      randomSeeds[i] = Math.random() * 1000.0;
    }

    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute(positions, 3)
    );
    this.geometry.setAttribute(
      'velocity',
      new Float32BufferAttribute(velocities, 2)
    );
    this.geometry.setAttribute(
      'lifetime',
      new Float32BufferAttribute(lifetimes, 1)
    );
    this.geometry.setAttribute(
      'randomSeed',
      new Float32BufferAttribute(randomSeeds, 1)
    );

    // Update the points mesh with new geometry
    this.points.geometry = this.geometry;
  }

  setParticleSize(size) {
    this.material.uniforms.particleSize.value = size;
  }

  setParticleSpeed(speed) {
    this.material.uniforms.particleSpeed.value = speed;
  }

  setupGUI(gui) {
    const particles = gui.addFolder('Particles');

    particles.add(this.config, 'ShowParticles').name('Show Particles');

    particles
      .add(this.config, 'ParticleCount', 1000, 20000, 1000)
      .name('Count')
      .onChange((value) => {
        this.setParticleCount(value);
      });

    particles
      .add(this.config, 'ParticleSize', 0.5, 10.0, 0.5)
      .name('Size')
      .onChange((value) => {
        this.setParticleSize(value);
      });

    particles
      .add(this.config, 'ParticleSpeed', 0.1, 1.0, 0.1)
      .name('Speed')
      .onChange((value) => {
        this.setParticleSpeed(value);
      });

    particles.add(this.config, 'ParticleBoundaries').name('Boundaries');
    particles.add(this.config, 'ParticleColors').name('Colors');

    return particles; // Return the folder in case caller needs it
  }

  setBounds(width, height) {
    this.bounds = { width, height };
    this.material.uniforms.bounds.value.set(width, height);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }

  // Getter for adding to scene
  get mesh() {
    return this.points;
  }
}
