const bobComponent = {
  schema: {
    distance: {default: 0.2},
    duration: {default: 2000},
  },
  init() {
    const {el} = this
    const {data} = this
    data.initialPosition = this.el.object3D.position.clone()
    data.downPosition = data.initialPosition.clone().setZ(data.initialPosition.z - data.distance)
    data.upPosition = data.initialPosition.clone().setZ(data.initialPosition.z + data.distance)
    const vectorToString = v => `${v.x} ${v.y} ${v.z}`
    data.initialPosition = vectorToString(data.initialPosition)
    data.downPosition = vectorToString(data.downPosition)
    data.upPosition = vectorToString(data.upPosition)
    data.timeout = null
    const animatePosition = position => el.setAttribute('animation__bob', {
      property: 'position',
      to: position,
      dur: data.duration,
      easing: 'easeInOutQuad',
      loop: false,
    })
    const bobDown = () => {
      if (data.shouldStop) {
        animatePosition(data.initialPosition)
        data.stopped = true
        return
      }
      animatePosition(data.downPosition)
      data.timeout = setTimeout(bobUp, data.duration)
    }
    const bobUp = () => {
      if (data.shouldStop) {
        animatePosition(data.initialPosition)
        data.stopped = true
        return
      }
      animatePosition(data.upPosition)
      data.timeout = setTimeout(bobDown, data.duration)
    }
    const bobStop = () => {
      data.shouldStop = true
    }
    const bobStart = () => {
      if (data.stopped) {
        data.shouldStop = false
        data.stopped = false
        bobUp()
      }
    }
    this.el.addEventListener('bobStart', bobStart)
    this.el.addEventListener('bobStop', bobStop)
    bobUp()
  },
}

export {bobComponent}
