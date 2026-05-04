import './styles/prompt.css'
import './styles/index.css'

import {XRExtras} from './myxrextras/xrextras.js'
window.XRExtras = XRExtras

import {iframeEventsComponent} from './components/iframeEvents.js'
AFRAME.registerComponent('custom-events', iframeEventsComponent)

import {spawnComponent} from './components/spawn.js'
AFRAME.registerComponent('spawn', spawnComponent)

import {hologramTextureComponent} from './components/hologramTexture.js'
AFRAME.registerComponent('hologram-texture', hologramTextureComponent)

import {wireframeTextureComponent} from './components/wireframeMaterial.js'
AFRAME.registerComponent('wireframe-material', wireframeTextureComponent)

import {postprocessingComponent} from './components/postprocessing'
AFRAME.registerComponent('postprocessing', postprocessingComponent)

import {bobComponent} from './components/bob'
AFRAME.registerComponent('bob', bobComponent)

import {modelFadeComponent} from './components/model-fade'
AFRAME.registerComponent('model-fade', modelFadeComponent)

let inDom = false
const observer = new MutationObserver(() => {
  if (document.querySelector('.prompt-box-8w')) {
    if (!inDom) {
      document.querySelector('.prompt-box-8w p').innerHTML = 'augmented reality requires access to device motion sensors'
      document.querySelector('.prompt-button-8w').innerHTML = 'cancel'
      document.querySelector('.button-primary-8w').innerHTML = 'continue'
    }
    inDom = true
  } else if (inDom) {
    inDom = false
    observer.disconnect()
  }
})

observer.observe(document.body, {childList: true})

const onxrloaded = () => {
  XR8.XrController.configure({
    imageTargetData: [
      require('../image-targets/puzzle.json'),
    ],
  })
}
window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)
