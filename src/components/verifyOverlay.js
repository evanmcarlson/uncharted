const TARGET_NAME = 'puzzle'
const NEUTRAL_COLOR = '#E5E5E5'
const SUCCESS_COLOR = '#6FCF7C'
const ANIM_MS = 450
const LOST_DEBOUNCE_MS = 400

const VERIFY_ENDPOINT = 'https://nx5lhk5reut633vkglyc7n5uiy0mpqah.lambda-url.us-east-1.on.aws/'
const API_BASE = 'https://ovxjz5pwza.execute-api.us-east-1.amazonaws.com'

const _params = new URLSearchParams(location.search)
const SESSION_ID = _params.get('sessionId')
const PUZZLE_ID = _params.get('puzzleId') || location.pathname.split('/').filter(Boolean)[0]
const RETURN_URL = _params.get('returnUrl') || (PUZZLE_ID ? `/${PUZZLE_ID}` : '/')

let state = 'searching'
let isTracking = false
let currentCorners = null
let trackedObj = null
let targetLocalCorners = null
let lostTimer = null
let animId = null

let bTL, bTR, bBR, bBL, scanHint
let photoOverlay
let overlayVerifying, overlayResult, overlayIcon, overlayTitle, overlayReason, overlayActionBtn
let overlayNameGroup, overlayNameInput
let overlayDevVerifyBtn

function getReticleCorners() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.45
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2
  return {
    tl: { x: cx - size / 2, y: cy - size / 2 },
    tr: { x: cx + size / 2, y: cy - size / 2 },
    br: { x: cx + size / 2, y: cy + size / 2 },
    bl: { x: cx - size / 2, y: cy + size / 2 },
  }
}

function lerpPt(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function lerpCorners(from, to, t) {
  return {
    tl: lerpPt(from.tl, to.tl, t),
    tr: lerpPt(from.tr, to.tr, t),
    br: lerpPt(from.br, to.br, t),
    bl: lerpPt(from.bl, to.bl, t),
  }
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function projectCorner(localVec3, obj3D, camera, canvasRect) {
  const world = localVec3.clone().applyMatrix4(obj3D.matrixWorld)
  world.project(camera)
  return {
    x: (world.x + 1) / 2 * canvasRect.width + canvasRect.left,
    y: (1 - world.y) / 2 * canvasRect.height + canvasRect.top,
  }
}

function computeProjectedCorners(sceneEl) {
  if (!trackedObj || !targetLocalCorners) return null
  const rect = sceneEl.canvas.getBoundingClientRect()
  const cam = sceneEl.camera
  return {
    tl: projectCorner(targetLocalCorners.tl, trackedObj, cam, rect),
    tr: projectCorner(targetLocalCorners.tr, trackedObj, cam, rect),
    br: projectCorner(targetLocalCorners.br, trackedObj, cam, rect),
    bl: projectCorner(targetLocalCorners.bl, trackedObj, cam, rect),
  }
}

function bracketPath(corner, neighborA, neighborB, lenFrac = 0.22) {
  const a = lerpPt(corner, neighborA, lenFrac)
  const b = lerpPt(corner, neighborB, lenFrac)
  return `M ${a.x} ${a.y} L ${corner.x} ${corner.y} L ${b.x} ${b.y}`
}

function renderBrackets(corners) {
  bTL.setAttribute('d', bracketPath(corners.tl, corners.tr, corners.bl))
  bTR.setAttribute('d', bracketPath(corners.tr, corners.br, corners.tl))
  bBR.setAttribute('d', bracketPath(corners.br, corners.bl, corners.tr))
  bBL.setAttribute('d', bracketPath(corners.bl, corners.tl, corners.br))
}

function setBracketColor(color) {
  ;[bTL, bTR, bBR, bBL].forEach(el => (el.style.stroke = color))
}

function setSvgBreathing(on) {
  document.getElementById('scan-svg').classList.toggle('breathing', on)
}

function animateTo(from, to, easeFn, onComplete) {
  if (animId) { cancelAnimationFrame(animId); animId = null }
  const start = performance.now()
  function step(now) {
    const t = Math.min((now - start) / ANIM_MS, 1)
    currentCorners = lerpCorners(from, to, easeFn(t))
    renderBrackets(currentCorners)
    if (t < 1) {
      animId = requestAnimationFrame(step)
    } else {
      animId = null
      onComplete?.()
    }
  }
  animId = requestAnimationFrame(step)
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch (e) {}
}

function showOverlayVerifying() {
  overlayVerifying.style.display = 'flex'
  overlayResult.style.display = 'none'
  photoOverlay.classList.add('visible')
  photoOverlay.classList.add('verifying')
}

function showOverlayResult(success, title, reason, btnLabel) {
  overlayVerifying.style.display = 'none'
  photoOverlay.classList.remove('verifying')
  overlayIcon.className = success ? 'success' : 'failed'
  overlayIcon.textContent = success ? '✓' : '✕'
  overlayTitle.textContent = title
  overlayReason.textContent = reason || ''
  overlayActionBtn.textContent = btnLabel
  overlayResult.style.display = 'flex'
  if (overlayDevVerifyBtn) overlayDevVerifyBtn.style.display = success ? 'none' : ''
}

function hidePhotoOverlay() {
  photoOverlay.classList.remove('visible')
}

function captureFrame(sceneEl) {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      try {
        const canvas = sceneEl.canvas
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve(dataUrl.split(',')[1])
      } catch (e) {
        reject(e)
      }
    })
  })
}

async function callVerifyAPI(base64Image) {
  const res = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  })
  if (!res.ok) {
    let detail = res.status === 504 || res.status === 502
      ? 'Request timed out — please try again.'
      : `API error: ${res.status}`
    try {
      const body = await res.json()
      detail = body?.detail || body?.error || detail
    } catch (_) {}
    throw new Error(detail)
  }
  return res.json()
}

async function runVerify(sceneEl) {
  if (state !== 'locked') return

  let base64
  try {
    base64 = await captureFrame(sceneEl)
  } catch (err) {
    console.error('[verify] capture error', err)
    return
  }

  showOverlayVerifying()
  enterVerifying()

  try {
    const result = await callVerifyAPI(base64)
    if (result.complete) {
      const actionLabel = SESSION_ID ? null : 'Done'
      showOverlayResult(true, 'Puzzle Complete!', result.reason, actionLabel)
      if (SESSION_ID) {
        overlayNameGroup.style.display = 'flex'
        overlayActionBtn.style.display = 'none'
        overlayNameInput.focus()
      }
      enterSuccess()
    } else {
      showOverlayResult(false, 'Puzzle Incomplete', result.reason || 'Could not confirm the puzzle is fully assembled.', 'Try Again')
      enterFailed()
    }
  } catch (err) {
    console.error('[verify] error', err)
    showOverlayResult(false, 'Something went wrong', err?.message || 'Please try again.', 'Try Again')
    enterFailed()
  }
}

function enterSearching() {
  state = 'searching'
  setBracketColor(NEUTRAL_COLOR)
  scanHint.classList.remove('hidden')

  const from = currentCorners || getReticleCorners()
  animateTo(from, getReticleCorners(), easeInOutQuad, () => {
    setSvgBreathing(true)
  })
}

function enterLocked(detail, sceneEl) {
  if (lostTimer) { clearTimeout(lostTimer); lostTimer = null }

  trackedObj.position.copy(detail.position)
  trackedObj.quaternion.copy(detail.rotation)
  trackedObj.updateMatrixWorld(true)

  const w = detail.scaledWidth * detail.scale, h = detail.scaledHeight * detail.scale
  const V3 = window.THREE.Vector3
  targetLocalCorners = {
    tl: new V3(-w / 2,  h / 2, 0),
    tr: new V3( w / 2,  h / 2, 0),
    br: new V3( w / 2, -h / 2, 0),
    bl: new V3(-w / 2, -h / 2, 0),
  }

  const projected = computeProjectedCorners(sceneEl)
  if (!projected) return

  if (navigator.vibrate) navigator.vibrate(10)
  playChime()

  state = 'locked'
  setSvgBreathing(false)
  setBracketColor(SUCCESS_COLOR)
  scanHint.classList.add('hidden')

  const from = currentCorners || getReticleCorners()
  animateTo(from, projected, easeOutBack, () => runVerify(sceneEl))
}

function enterVerifying() {
  state = 'verifying'
}

function enterSuccess() {
  state = 'success'
  setBracketColor(SUCCESS_COLOR)
  playChime()
}

function enterFailed() {
  state = 'locked'
  setBracketColor(NEUTRAL_COLOR)
}

export function setupVerifyOverlay(sceneEl) {
  bTL = document.getElementById('bracket-tl')
  bTR = document.getElementById('bracket-tr')
  bBR = document.getElementById('bracket-br')
  bBL = document.getElementById('bracket-bl')
  scanHint = document.getElementById('scan-hint')
  photoOverlay = document.getElementById('photo-overlay')
  overlayVerifying = document.getElementById('overlay-verifying')
  overlayResult = document.getElementById('overlay-result')
  overlayIcon = document.getElementById('overlay-icon')
  overlayTitle = document.getElementById('overlay-title')
  overlayReason = document.getElementById('overlay-reason')
  overlayActionBtn = document.getElementById('overlay-action-btn')
  overlayNameGroup = document.getElementById('overlay-name-group')
  overlayNameInput = document.getElementById('overlay-name-input')
  const overlaySubmitBtn = document.getElementById('overlay-submit-btn')
  overlayDevVerifyBtn = document.getElementById('overlay-dev-verify-btn')

  overlayActionBtn.addEventListener('click', () => {
    if (state === 'success') {
      location.href = RETURN_URL
      return
    }
    hidePhotoOverlay()
    if (isTracking) {
      setTimeout(() => runVerify(sceneEl), 500)
    } else {
      enterSearching()
    }
  })

  overlaySubmitBtn.addEventListener('click', async () => {
    const displayName = overlayNameInput.value.trim()
    if (!displayName) { overlayNameInput.focus(); return }

    overlaySubmitBtn.disabled = true
    overlaySubmitBtn.textContent = 'Submitting…'

    try {
      const res = await fetch(`${API_BASE}/session/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID, displayName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')

      const mins = Math.floor(data.elapsedSeconds / 60)
      const secs = String(data.elapsedSeconds % 60).padStart(2, '0')
      overlayNameGroup.style.display = 'none'
      overlayReason.textContent = `Your time: ${mins}:${secs} · Rank #${data.rank}`
      overlayActionBtn.textContent = 'Done'
      overlayActionBtn.style.display = ''
    } catch (err) {
      overlaySubmitBtn.disabled = false
      overlaySubmitBtn.textContent = 'Submit to Leaderboard'
      overlayReason.textContent = err.message
    }
  })

  if (overlayDevVerifyBtn) {
    overlayDevVerifyBtn.addEventListener('click', () => {
      overlayDevVerifyBtn.style.display = 'none'
      showOverlayResult(true, 'Puzzle Complete!', 'Dev override', SESSION_ID ? null : 'Done')
      if (SESSION_ID) {
        overlayNameGroup.style.display = 'flex'
        overlayActionBtn.style.display = 'none'
        overlayNameInput.focus()
      }
      enterSuccess()
    })
  }

  trackedObj = new window.THREE.Object3D()
  sceneEl.object3D.add(trackedObj)

  sceneEl.addEventListener('xrimagefound', ({ detail }) => {
    isTracking = true
    if (state !== 'locked') enterLocked(detail, sceneEl)
  })

  sceneEl.addEventListener('xrimageupdated', ({ detail }) => {
    trackedObj.position.copy(detail.position)
    trackedObj.quaternion.copy(detail.rotation)
    trackedObj.updateMatrixWorld(true)
    if (state === 'locked' && !animId) {
      const projected = computeProjectedCorners(sceneEl)
      if (projected) {
        currentCorners = projected
        renderBrackets(projected)
      }
    }
  })

  sceneEl.addEventListener('xrimagelost', () => {
    if (lostTimer) clearTimeout(lostTimer)
    lostTimer = setTimeout(() => {
      lostTimer = null
      isTracking = false
      enterSearching()
    }, LOST_DEBOUNCE_MS)
  })

  currentCorners = getReticleCorners()
  renderBrackets(currentCorners)
  setBracketColor(NEUTRAL_COLOR)
  setSvgBreathing(true)
}
