import {
  OrthographicCamera,
  TextureLoader,
  Vector2,
  Vector4,
  WebGLRenderer,
  UnsignedByteType,
} from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { AdvectionPass } from './passes/AdvectionPass.js';
import { BoundaryPass } from './passes/BoundaryPass.js';
import { CompositionPass } from './passes/CompositionPass.js';
import { DivergencePass } from './passes/DivergencePass.js';
import { GradientSubtractionPass } from './passes/GradientSubtractionPass.js';
import { JacobiIterationsPass } from './passes/JacobiIterationsPass.js';
import { TouchColorPass } from './passes/TouchColorPass.js';
import { TouchForcePass } from './passes/TouchForcePass.js';
import { RenderTarget } from './RenderTarget.js';
import { ParticleSystem } from './ParticleSystem.js';

const gradients = ['gradient-2.png'];
const gradientTextures = [];

// App configuration options.
const configuration = {
  Iterations: 32,
  Radius: 0.25,
  Scale: 0.5,
  ColorDecay: 0.01,
  Smoothing: 0.8,
  Boundaries: false,
  Visualize: 'Color',
  Mode: 'Gradient',
  Timestep: '1/60',
  Opacity: 1.0,
};

// Html/Three.js initialization.
const canvas = document.getElementById('canvas');
const stats = new Stats();
canvas.parentElement.appendChild(stats.dom);
const gui = new GUI();
initGUI();

const renderer = new WebGLRenderer({
  canvas,
});
renderer.autoClear = false;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
let dt = 1 / 60;

const resolution = new Vector2(
  configuration.Scale * window.innerWidth,
  configuration.Scale * window.innerHeight
);
const aspect = new Vector2(resolution.x / resolution.y, 1.0);

// RenderTargets initialization.
const velocityRT = new RenderTarget(resolution, 2);
const divergenceRT = new RenderTarget(resolution, 1);
const pressureRT = new RenderTarget(resolution, 2);
const colorRT = new RenderTarget(resolution, 2, UnsignedByteType);

// These variables are used to store the result the result of the different
// render passes. Not needed but nice for convenience.
let c;
let v;
let d;
let p;

// Render passes initialization.
const velocityInitTexture = new RenderTarget(resolution, 1);
const colorInitTexture = new RenderTarget(resolution, 1);
const velocityAdvectionPass = new AdvectionPass(
  velocityInitTexture,
  velocityInitTexture,
  0
);
const colorAdvectionPass = new AdvectionPass(
  velocityInitTexture,
  colorInitTexture,
  configuration.ColorDecay
);
const touchForcePass = new TouchForcePass(resolution, configuration.Radius);
const touchColorPass = new TouchColorPass(resolution, configuration.Radius);
const boundaryPass = new BoundaryPass();
const divergencePass = new DivergencePass();
const jacobiIterationsPass = new JacobiIterationsPass();
const gradientSubtractionPass = new GradientSubtractionPass();
const compositionPass = new CompositionPass();

// Particle system initialization
const particleSystem = new ParticleSystem(
  5000, // Default particle count
  { width: 2, height: 2 }, // Normalized screen space bounds
  gui
);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);

  resolution.set(configuration.Scale * w, configuration.Scale * h);
  velocityRT.resize(resolution);
  divergenceRT.resize(resolution);
  pressureRT.resize(resolution);
  colorRT.resize(resolution);

  aspect.set(resolution.x / resolution.y, 1.0);
  touchForcePass.update({ aspect });
  touchColorPass.update({ aspect });

  jacobiIterationsPass.update({ resolution: resolution });
  gradientSubtractionPass.update({ resolution: resolution });
  divergencePass.update({ resolution: resolution });
  boundaryPass.update({ resolution: resolution });
}
// Event listeners (resizing and mouse/touch input).
window.addEventListener('resize', onResize);

let inputTouches = [];
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const x = (event.clientX / canvas.clientWidth) * aspect.x;
  const y = 1.0 - (event.clientY + window.scrollY) / canvas.clientHeight;
  inputTouches.push({
    id: event.pointerId,
    input: new Vector4(x, y, 0, 0),
    smoothedInput: new Vector4(x, y, 0, 0), // Add smoothed position tracking
  });
});

canvas.addEventListener('pointermove', (event) => {
  event.preventDefault();
  const registeredTouch = inputTouches.find(
    (value) => value.id === event.pointerId
  );
  if (registeredTouch !== undefined) {
    const x = (event.clientX / canvas.clientWidth) * aspect.x;
    const y = 1.0 - (event.clientY + window.scrollY) / canvas.clientHeight;

    // Apply smoothing to the position
    const smoothing = configuration.Smoothing;
    const newSmoothedX =
      registeredTouch.smoothedInput.x * smoothing + x * (1 - smoothing);
    const newSmoothedY =
      registeredTouch.smoothedInput.y * smoothing + y * (1 - smoothing);

    // Calculate velocity based on smoothed position change
    registeredTouch.input
      .setZ(newSmoothedX - registeredTouch.smoothedInput.x)
      .setW(newSmoothedY - registeredTouch.smoothedInput.y);

    // Update positions
    registeredTouch.input.setX(newSmoothedX).setY(newSmoothedY);
    registeredTouch.smoothedInput.setX(newSmoothedX).setY(newSmoothedY);
  }
});

canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  inputTouches = inputTouches.filter((value) => value.id !== event.pointerId);
});

canvas.addEventListener('pointercancel', (event) => {
  event.preventDefault();
  inputTouches = inputTouches.filter((value) => value.id !== event.pointerId);
});

// Dat.GUI configuration.
function loadGradients() {
  const textureLoader = new TextureLoader();
  for (let i = 0; i < gradients.length; ++i) {
    textureLoader.load(gradients[i], (texture) => {
      gradientTextures[i] = texture;
    });
  }
}

// Dat.GUI configuration.
function initGUI() {
  const sim = gui.addFolder('Simulation');
  sim.add(configuration, 'Scale', 0.1, 2.0, 0.1).onFinishChange((value) => {
    resolution.set(
      configuration.Scale * window.innerWidth,
      configuration.Scale * window.innerHeight
    );
    velocityRT.resize(resolution);
    divergenceRT.resize(resolution);
    pressureRT.resize(resolution);
    colorRT.resize(resolution);
  });
  sim.add(configuration, 'Iterations', 16, 128, 1);
  sim.add(configuration, 'ColorDecay', 0.0, 0.02, 0.001);
  sim
    .add(configuration, 'Timestep', ['1/15', '1/30', '1/60', '1/90', '1/120'])
    .onChange((value) => {
      switch (value) {
        case '1/15':
          dt = 1 / 15;
          break;
        case '1/30':
          dt = 1 / 30;
          break;
        case '1/60':
          dt = 1 / 60;
          break;
        case '1/90':
          dt = 1 / 90;
          break;
        case '1/120':
          dt = 1 / 120;
          break;
      }
    });
  sim.add(configuration, 'Boundaries');

  const input = gui.addFolder('Input');
  input.add(configuration, 'Radius', 0.1, 1, 0.1);
  input.add(configuration, 'Smoothing', 0.0, 0.95, 0.05).name('Smoothing');

  gui.add(configuration, 'Visualize', [
    'Color',
    'Velocity',
    'Divergence',
    'Pressure',
  ]);
  gui.add(configuration, 'Mode', [
    'Normal',
    'Luminance',
    'Spectral',
    'Gradient',
  ]);
  gui.add(configuration, 'Opacity', 0.0, 1.0, 0.1).name('Opacity');
}

// Render loop.
function render() {
  // Advect the velocity vector field.
  velocityAdvectionPass.update({ timeDelta: dt });
  v = velocityRT.set(renderer);
  renderer.render(velocityAdvectionPass.scene, camera);

  // Add external forces/colors according to input.
  if (inputTouches.length > 0) {
    touchForcePass.update({
      touches: inputTouches,
      radius: configuration.Radius,
      velocity: v,
    });
    v = velocityRT.set(renderer);
    renderer.render(touchForcePass.scene, camera);

    touchColorPass.update({
      touches: inputTouches,
      radius: configuration.Radius,
      color: c,
    });
    c = colorRT.set(renderer);
    renderer.render(touchColorPass.scene, camera);
  }

  // Add velocity boundaries (simulation walls).
  if (configuration.Boundaries) {
    boundaryPass.update({ velocity: v });
    v = velocityRT.set(renderer);
    renderer.render(boundaryPass.scene, camera);
  }

  // Compute the divergence of the advected velocity vector field.
  divergencePass.update({
    timeDelta: dt,
    velocity: v,
  });
  d = divergenceRT.set(renderer);
  renderer.render(divergencePass.scene, camera);

  // Compute the pressure gradient of the advected velocity vector field (using
  // jacobi iterations).
  jacobiIterationsPass.update({ divergence: d });
  for (let i = 0; i < configuration.Iterations; ++i) {
    p = pressureRT.set(renderer);
    renderer.render(jacobiIterationsPass.scene, camera);
    jacobiIterationsPass.update({ previousIteration: p });
  }

  // Substract the pressure gradient from to obtain a velocity vector field with
  // zero divergence.
  gradientSubtractionPass.update({
    timeDelta: dt,
    velocity: v,
    pressure: p,
  });
  v = velocityRT.set(renderer);
  renderer.render(gradientSubtractionPass.scene, camera);

  // Advect the color buffer with the divergence-free velocity vector field.
  colorAdvectionPass.update({
    timeDelta: dt,
    inputTexture: c,
    velocity: v,
    decay: configuration.ColorDecay,
  });
  c = colorRT.set(renderer);
  renderer.render(colorAdvectionPass.scene, camera);

  // Feed the input of the advection passes with the last advected results.
  velocityAdvectionPass.update({
    inputTexture: v,
    velocity: v,
  });
  colorAdvectionPass.update({
    inputTexture: c,
  });

  // Render to the main framebuffer the desired visualization.
  renderer.setRenderTarget(null);
  let visualization;
  switch (configuration.Visualize) {
    case 'Color':
      visualization = c;
      break;
    case 'Velocity':
      visualization = v;
      break;
    case 'Divergence':
      visualization = d;
      break;
    case 'Pressure':
      visualization = p;
      break;
  }
  compositionPass.update({
    colorBuffer: visualization,
    mode: configuration.Mode,
    gradient: gradientTextures[0],
    opacity: configuration.Opacity,
  });
  renderer.render(compositionPass.scene, camera);

  // Update and render particles
  if (particleSystem.config.ShowParticles && v && c) {
    particleSystem.update(
      dt,
      v,
      c,
      particleSystem.config.ParticleBoundaries,
      particleSystem.config.ParticleSpeed,
      particleSystem.config.ParticleColors
    );
    renderer.render(particleSystem.scene, camera);
  }
}
function animate() {
  requestAnimationFrame(animate);
  stats.begin();
  render();
  stats.end();
}
onResize();
animate();

loadGradients();
