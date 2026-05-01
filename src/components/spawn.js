const spawnComponent = {
  init() {
    const puzzle = document.getElementById('puzzle')
    const octopus = document.getElementById('octopus')

    const finishedAnimation = false
    // const setScale = () => {
    //   console.log('finished')
    //   octo.setAttribute('scale', '0.15 0.15 0.15')
    //   // this is when we should have world tracking take over
    // }

    const resetState = () => {
      console.log('lost')
      puzzle.removeAttribute('animation__fade')
      puzzle.removeAttribute('animation-mixer')
      octopus.removeAttribute('animation__position')
      octopus.setAttribute('position', '0 0 -1')
      this.el.object3D.visible = false
    }

    const revealOctopus = () => {
      // puzzle.removeEventListener('animation-finished', revealOctopus)
      // console.log('reveal octopus')
      // // swimp up
      // octopus.setAttribute('animation__position', 'property: position; to: 0 0 0; easing: easeOutQuad')

      // bob="distance: 0.1"
    }

    // would be cool if this was a shimmer effect/scanning effect
    const fadeIn = () => {
      console.log('fade in')
      puzzle.setAttribute('animation__fade', 'property: model-fade.opacity; from: 0; to: 1; dur: 2500')
    }

    const startAnimation = () => {
      console.log('start animation')
      puzzle.setAttribute('animation-mixer', 'clip: *; loop: once; clampWhenFinished: true;')
      octopus.setAttribute('animation__position', 'property: position; from: 0 0 -1; to: 0 0 0; easing: easeOutQuad')
    }

    const updated = ({detail}) => {
      console.log('update')
      this.el.object3D.position.copy(detail.position)
      this.el.object3D.quaternion.copy(detail.rotation)
      this.el.object3D.scale.set(detail.scale, detail.scale, detail.scale)
    }

    const found = (detail) => {
      console.log('found')
      updated(detail)

      this.el.object3D.visible = true
      fadeIn()
    }

    const animationFinished = () => {
      console.log('animation finished')
      octopus.setAttribute('bob', 'distance: 0.1')
      this.el.sceneEl.emit('solved')
    }

    this.el.sceneEl.addEventListener('xrimagefound', found)
    this.el.sceneEl.addEventListener('xrimageupdated', updated)
    // could consider disable setting visible=false to let world tracking take over
    this.el.sceneEl.addEventListener('xrimagelost', resetState)

    puzzle.addEventListener('animationcomplete__fade', startAnimation)

    puzzle.addEventListener('animation-finished', animationFinished)

    // const btn = document.getElementById('start')
    // btn.addEventListener('click', startSequence)
  },
}

export {spawnComponent}
