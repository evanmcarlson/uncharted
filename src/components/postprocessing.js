const postprocessingComponent = {
  init() {
    const scene = this.el.sceneEl.object3D
    const {camera, renderer} = this.el.sceneEl

    let videoWidth_
    let videoHeight_
    let canvasWidth_ = window.innerWidth
    let canvasHeight_ = window.innerHeight
    let cameraFeedRenderer_

    const camTexture_ = new THREE.Texture()
    camTexture_.encoding = THREE.sRGBEncoding
    let combineComposer
    let effectComposer
    let sceneTarget
    let effectRenderTarget
    const EFFECT_SCENE = 1
    const effectLayer = new THREE.Layers()
    effectLayer.set(EFFECT_SCENE)

    const entities = []

    const updateSize = ({videoWidth, videoHeight, canvasWidth, canvasHeight, GLctx}) => {
      const width = canvasWidth
      const height = canvasHeight

      cameraFeedRenderer_ = window.XR8.GlTextureRenderer.create({
        GLctx,
        toTexture: {width, height},
        flipY: false,
        mirroredDisplay: false,
      })

      canvasWidth_ = canvasWidth
      canvasHeight_ = canvasHeight
      videoWidth_ = videoWidth
      videoHeight_ = videoHeight
    }

    const addHtmlContent = () => new Promise((resolve, reject) => {
      const shaderScripts = `
      <script type="x-shader/x-vertex" id="vertexshader">
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      </script>
      <script type="x-shader/x-fragment" id="fragmentshader">
        uniform sampler2D cameraTexture;
        uniform sampler2D tDiffuse; // Scene contents 
        uniform sampler2D processedTexture;
        uniform vec2 u_resolutionRatio;
        uniform bool useAdditiveBlend;
        
        varying vec2 vUv;
        
        vec4 normalBlend(vec4 x, vec4 y, float opacity) {
          return y * opacity + x * (1.0 - opacity);
        }
        
        void main(void) {
          vec4 cameraColor = texture2D(cameraTexture, vUv);
          vec4 sceneColor = texture2D(tDiffuse, vUv);
          vec4 processedColor = texture2D(processedTexture, vUv);
        
          gl_FragColor = normalBlend(cameraColor, sceneColor, sceneColor.a);
          gl_FragColor += processedColor;
        }
      </script>
    `

      document.body.insertAdjacentHTML('beforeend', shaderScripts)

      if (document.getElementById('vertexshader') && document.getElementById('fragmentshader')) {
        resolve()
      } else {
        reject(new Error('HTMLコンテンツの追加に失敗しました'))
      }
    })

    const onxrloaded = async () => {
      await addHtmlContent()
      XR8.addCameraPipelineModule({
        name: 'postprocessing',
        onStart: ({videoWidth, videoHeight, canvasWidth, canvasHeight, GLctx}) => {
          updateSize({videoWidth, videoHeight, canvasWidth, canvasHeight, GLctx})
        },

        onUpdate: ({processCpuResult}) => {
          const realitySource = processCpuResult.reality || processCpuResult.facecontroller ||
            processCpuResult.layerscontroller || processCpuResult.handcontroller

          if (!(realitySource && realitySource.intrinsics)) {
            return
          }

          const realityTexture = realitySource.realityTexture || realitySource.cameraFeedTexture

          const texProps = renderer.properties.get(camTexture_)

          texProps.__webglTexture = cameraFeedRenderer_.render({
            renderTexture: realityTexture,
            viewport: window.XR8.GlTextureRenderer.fillTextureViewport(
              videoWidth_,
              videoHeight_,
              canvasWidth_,
              canvasHeight_
            ),
          })
        },

        onCanvasSizeChange: ({canvasWidth, canvasHeight}) => {
          const pixelRatio = THREE.MathUtils.clamp(window.devicePixelRatio, 1, 2)
          renderer.pixelRatio = pixelRatio
          renderer.setSize(canvasWidth, canvasHeight)
          const canvas = renderer.domElement
          combineComposer.setSize(
            canvasWidth * pixelRatio,
            canvasHeight * pixelRatio
          )
          combineComposer.passes.forEach((pass) => {
            if (pass.setSize) {
              pass.setSize(canvasWidth * pixelRatio, canvasHeight * pixelRatio)
            }
          })
          if (sceneTarget) {
            sceneTarget.setSize(
              canvasWidth * pixelRatio,
              canvasHeight * pixelRatio
            )
          }
          effectComposer.setSize(
            canvasWidth * pixelRatio,
            canvasHeight * pixelRatio
          )
          effectComposer.passes.forEach((pass) => {
            if (pass.setSize) {
              pass.setSize(canvasWidth * pixelRatio, canvasHeight * pixelRatio)
            }
          })
          if (effectRenderTarget) {
            effectRenderTarget.setSize(
              canvasWidth * pixelRatio,
              canvasHeight * pixelRatio
            )
          }
        },

        onDeviceOrientationChange: ({videoWidth, videoHeight, GLctx}) => {
          updateSize(
            {videoWidth, videoHeight, canvasWidth: canvasWidth_, canvasHeight: canvasHeight_, GLctx}
          )
        },
      })
    }
    window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)

    // effectComposer
    effectComposer = new THREE.EffectComposer(renderer)
    effectComposer.setSize(canvasWidth_, canvasHeight_)
    effectComposer.renderToScreen = false
    effectRenderTarget = new THREE.WebGLRenderTarget(canvasWidth_, canvasHeight_, {
      generateMipmaps: false,
    })
    const baseTexturePass = new THREE.TexturePass(effectRenderTarget.texture)
    effectComposer.addPass(baseTexturePass)

    // add postprocessing effect pass
    const params = {
      strength: 0.3,
      radius: 0.25,
      threshold: 0,
      exposure: 1,
    }
    const UnrealBloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(canvasWidth_, canvasHeight_),
      params.strength,
      params.radius,
      params.threshold
    )
    UnrealBloomPass.clearColor = new THREE.Color(0xffffff)
    effectComposer.addPass(UnrealBloomPass)

    // combineComposer
    combineComposer = new THREE.EffectComposer(renderer)
    combineComposer.setSize(window.innerWidth, window.innerHeight)

    sceneTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      generateMipmaps: false,
    })

    const texturePass = new THREE.TexturePass(sceneTarget.texture)
    combineComposer.addPass(texturePass)

    const combineShaderFrag = document.getElementById('fragmentshader').textContent
    const combineShaderVert = document.getElementById('vertexshader').textContent
    const combineShader = {
      uniforms: {
        cameraTexture: {value: null},
        processedTexture: {value: null},
        tDiffuse: {value: null},
        useAdditiveBlend: {value: true},
      },
      fragmentShader: combineShaderFrag,
      vertexShader: combineShaderVert,
    }

    const combinePass = new THREE.ShaderPass(combineShader)
    combinePass.clear = false
    combinePass.renderToScreen = true
    combinePass.uniforms.cameraTexture.value = camTexture_
    combinePass.uniforms.processedTexture = {
      value: UnrealBloomPass.renderTargetsHorizontal[0].texture,
    }
    combineComposer.addPass(combinePass)

    // EFFECT_SCENE(not in use)
    const bounceLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5)
    scene.add(bounceLight)
    bounceLight.layers.set(EFFECT_SCENE)

    // rendering
    const materials = {}
    const darkMaterial = new THREE.MeshBasicMaterial({color: 'black'})
    const darkenNonBloomed = (obj) => {
      if (obj.material !== undefined && obj.material !== null) {
        materials[obj.uuid] = obj.material
        obj.material = darkMaterial
      } else {
        obj.traverse((child) => {
          if (child.isMesh) {
            materials[child.uuid] = child.material
            child.material = darkMaterial
          }
        })
      }
    }

    const restoreMaterial = (obj) => {
      if (obj.material !== undefined && obj.material !== null) {
        if (materials[obj.uuid]) {
          obj.material = materials[obj.uuid]
          delete materials[obj.uuid]
        }
      } else {
        obj.traverse((child) => {
          if (child.isMesh) {
            if (materials[child.uuid]) {
              child.material = materials[child.uuid]
              delete materials[child.uuid]
            }
          }
        })
      }
    }

    const {render} = renderer
    let calledByComposer = false

    renderer.render = (...args) => {
      if (!window.XR8.isInitialized()) {
        return
      }

      if (calledByComposer) {
        render.apply(renderer, args)
      } else {
        calledByComposer = true
        if (entities.length) {
          for (let i = 0; i < entities.length; i++) {
            if (entities[i].depthWrite && !entities[i].bloom) {
              darkenNonBloomed(entities[i].mesh)
            }
          }
        }
        renderer.setRenderTarget(effectRenderTarget)
        renderer.clear()
        renderer.clearDepth()
        render.apply(renderer, args)
        effectComposer.render()
        if (entities.length) {
          for (let i = 0; i < entities.length; i++) {
            if (entities[i].depthWrite && !entities[i].bloom) {
              restoreMaterial(entities[i].mesh)
            }
          }
        }
        renderer.setRenderTarget(sceneTarget)
        renderer.clear()
        render.apply(renderer, args)

        renderer.setRenderTarget(null)
        combineComposer.render()

        calledByComposer = false
      }
    }
    // For entities under scene, look at the value of data-bloom and store it in entities
    const checkEntities = (entity) => {
      if (entity && entity.object3D) {
        entity.object3D.traverse((child) => {
          if (child.isMesh) {
            const bloomAttr = entity.getAttribute('data-bloom')
            const bloom = bloomAttr === 'bloom'
            const nonBloom = bloomAttr === 'non-bloom'
            const depthWrite = bloom || nonBloom
            const bloomEnabled = bloom

            entities.push({
              mesh: child,
              layerEnabled: false,
              depthWrite,
              bloom: bloomEnabled,
            })

            if (depthWrite) {
              child.layers.enable(EFFECT_SCENE)
            }
          }
        })
      }
    }

    const entities_ = this.el.sceneEl.querySelectorAll('*')
    entities_.forEach((entity) => {
      if (entity.hasLoaded) {
        checkEntities(entity)
      } else {
        entity.addEventListener('loaded', () => {
          checkEntities(entity)
        })
      }
    })
  },
}
export {postprocessingComponent}
