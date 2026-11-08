'use strict';

// Small WebGL1 screen-space post-process for the 2D Canvas game and the LAN
// client video. The source game remains Canvas 2D: only this warped copy uses
// WebGL. Nothing here changes world/collision coordinates or mouse inputs.
class NauseaWarp {
  constructor(source, canvas) {
    this.source = source;
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.disabled = !source || !canvas;
    this.contextLost = false;
    this.downsampleCanvas = null;
    this.downsampleContext = null;
    this.running = false;
    this.dizzy = 0;
    this.purple = 0;
    this.tick = (time) => {
      if (this.dizzy <= 0 && this.purple <= 0) {
        this.running = false;
        if (this.canvas) this.canvas.style.display = 'none';
        return;
      }
      this.renderFrame(time * 0.001);
      requestAnimationFrame(this.tick);
    };

    if (this.canvas) {
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.contextLost = true;
        this.gl = null;
        this.program = null;
        this.texture = null;
        this.canvas.style.display = 'none';
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
        this.gl = null;
        this.program = null;
        this.texture = null;
      });
    }
  }

  setIntensity(dizzy = 0, purple = 0) {
    this.dizzy = MathEx.clamp(Number(dizzy) || 0, 0, 0.5);
    this.purple = MathEx.clamp(Number(purple) || 0, 0, 0.5);
    if (this.canvas && this.dizzy <= 0 && this.purple <= 0) {
      this.canvas.style.display = 'none';
    }
    if (!this.disabled && !this.running && (this.dizzy > 0 || this.purple > 0)) {
      this.running = true;
      requestAnimationFrame(this.tick);
    }
  }

  compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Nausea shader compile: ' + error);
    }
    return shader;
  }

  initialize() {
    if (this.gl && this.program) return true;
    if (this.disabled || this.contextLost) return false;

    let gl = null;
    try {
      gl = this.canvas.getContext('webgl', {
        alpha:false,
        antialias:false,
        premultipliedAlpha:false,
        depth:false,
        stencil:false,
        preserveDrawingBuffer:false
      });
    } catch (error) {
      console.warn('WebGL nausea context is unavailable:', error);
    }
    if (!gl) {
      this.disabled = true;
      return false;
    }

    try {
      const vertex = this.compileShader(gl, gl.VERTEX_SHADER, [
        'attribute vec2 aPosition;',
        'varying vec2 vUV;',
        'void main(){',
        '  vUV = aPosition * 0.5 + 0.5;',
        '  gl_Position = vec4(aPosition, 0.0, 1.0);',
        '}'
      ].join('\n'));

      const fragment = this.compileShader(gl, gl.FRAGMENT_SHADER, [
        'precision mediump float;',
        'varying vec2 vUV;',
        'uniform sampler2D uScreen;',
        'uniform vec2 uResolution;',
        'uniform float uTime;',
        'uniform float uStrength;',
        'uniform float uPurple;',
        'void main(){',
        '  vec2 center = vUV - 0.5;',
        '  float dist = length(center * vec2(uResolution.x / uResolution.y, 1.0));',
        '  float ripple = sin(dist * 15.0 - uTime * 2.5);',
        '  float a = ripple * uStrength * (0.009 + uPurple * 0.003);',
        '  float cs = cos(a);',
        '  float sn = sin(a);',
        '  vec2 warped = vec2(center.x * cs - center.y * sn,',
        '                     center.x * sn + center.y * cs) + 0.5;',
        '  vec2 wave = vec2(',
        '    sin(warped.y * 17.0 + uTime * 2.8),',
        '    sin(warped.x * 13.0 - uTime * 2.3)',
        '  );',
        '  float pixels = (3.0 + uPurple * 2.0) + 7.5 * uStrength;',
        '  warped += wave * pixels * uStrength / uResolution;',
        '  gl_FragColor = texture2D(uScreen, clamp(warped, 0.001, 0.999));',
        '}'
      ].join('\n'));

      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Nausea program link: ' + gl.getProgramInfoLog(program));
      }

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
        gl.STATIC_DRAW
      );
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      this.gl = gl;
      this.program = program;
      this.texture = texture;
      this.locations = {
        sampler:gl.getUniformLocation(program, 'uScreen'),
        resolution:gl.getUniformLocation(program, 'uResolution'),
        time:gl.getUniformLocation(program, 'uTime'),
        strength:gl.getUniformLocation(program, 'uStrength'),
        purple:gl.getUniformLocation(program, 'uPurple')
      };
      gl.uniform1i(this.locations.sampler, 0);
      return true;
    } catch (error) {
      console.warn('Nausea warp unavailable:', error);
      this.disabled = true;
      this.canvas.style.display = 'none';
      return false;
    }
  }

  sourceSize() {
    // WebRTC remote video has intrinsic video dimensions. Its object-fit:contain
    // bounds must be used to keep the warped copy aligned with letterboxing.
    if (this.source instanceof HTMLVideoElement) {
      if (this.source.readyState < 2 ||
          !this.source.videoWidth || !this.source.videoHeight) return null;
      const parent = this.canvas.parentElement?.getBoundingClientRect?.();
      if (!parent || parent.width <= 0 || parent.height <= 0) return null;
      const ratio = Math.min(
        parent.width / this.source.videoWidth,
        parent.height / this.source.videoHeight
      );
      const width = this.source.videoWidth * ratio;
      const height = this.source.videoHeight * ratio;
      this.canvas.style.left = (parent.width - width) * 0.5 + 'px';
      this.canvas.style.top = (parent.height - height) * 0.5 + 'px';
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      return { width, height };
    }

    if (!this.source.width || !this.source.height) return null;
    const bounds = this.source.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return { width:bounds.width, height:bounds.height };
  }

  renderFrame(timeSeconds) {
    if (this.disabled) return false;
    const bounds = this.sourceSize();
    if (!bounds || !this.initialize()) return false;

    const gl = this.gl;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = Math.min(1, 2048 / Math.max(bounds.width, bounds.height) / ratio);
    const width = Math.max(1, Math.round(bounds.width * ratio * scale));
    const height = Math.max(1, Math.round(bounds.height * ratio * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      // High-DPI Canvas2D sources can be much larger than the overlay itself.
      // Reuse a 2D downsample buffer to avoid uploading a 4K texture each frame.
      // WebRTC video uses its original source directly to preserve stream access.
      let upload = this.source;
      if (!(this.source instanceof HTMLVideoElement) &&
          this.source.width > width * 1.35) {
        if (!this.downsampleCanvas) {
          this.downsampleCanvas = document.createElement('canvas');
          this.downsampleContext = this.downsampleCanvas.getContext('2d', {
            alpha:false
          });
        }
        if (this.downsampleContext) {
          if (this.downsampleCanvas.width !== width ||
              this.downsampleCanvas.height !== height) {
            this.downsampleCanvas.width = width;
            this.downsampleCanvas.height = height;
          }
          this.downsampleContext.imageSmoothingEnabled = false;
          this.downsampleContext.drawImage(this.source, 0, 0, width, height);
          upload = this.downsampleCanvas;
        }
      }

      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload
      );
      gl.useProgram(this.program);
      const strength = MathEx.clamp(
        Math.max(this.dizzy / 0.37, this.purple / 0.38 * 0.82),
        0, 1
      );
      gl.uniform2f(this.locations.resolution, width, height);
      gl.uniform1f(this.locations.time, timeSeconds);
      gl.uniform1f(this.locations.strength, strength);
      gl.uniform1f(this.locations.purple, this.purple > 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.canvas.style.display = 'block';
      return true;
    } catch (error) {
      console.warn('Nausea screen upload failed; keeping tint fallback:', error);
      this.disabled = true;
      this.canvas.style.display = 'none';
      return false;
    }
  }
}
