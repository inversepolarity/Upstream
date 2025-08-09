/* global YT */

let YTReady = false;
let player = null;
let isMuted = true;
let metaUpdateTimeout = null;
let isVisible = true;

// UI elements cache
const ui = {
  mainLoader: null,
  thumb: null,
  thumbLoader: null,
  title: null,
  titleContainer: null,
  channel: null,
  channelContainer: null,
  prev: null,
  play: null,
  pause: null,
  next: null,
  shuffle: null,
  mute: null,
  volumeWrap: null,
  volumeBar: null,
};

// Initialize UI cache
function initUI() {
  ui.mainLoader = document.getElementById('mainLoader');
  ui.thumb = document.getElementById('thumb');
  ui.thumbLoader = document.getElementById('thumbLoader');
  ui.title = document.getElementById('title');
  ui.titleContainer = document.getElementById('titleContainer');
  ui.channel = document.getElementById('channel');
  ui.channelContainer = document.getElementById('channelContainer');
  ui.prev = document.getElementById('prev');
  ui.play = document.getElementById('play');
  ui.pause = document.getElementById('pause');
  ui.next = document.getElementById('next');
  ui.shuffle = document.getElementById('shuffle');
  ui.mute = document.getElementById('mute');
  ui.volumeWrap = document.getElementById('volumeWrap');
  ui.volumeBar = document.getElementById('volumeBar');
}

// Intersection Observer for visibility optimization
function setupVisibilityObserver() {
  const playerElement = document.querySelector('.hud');
  if (!playerElement) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
        if (!isVisible) {
          if (metaUpdateTimeout) {
            clearTimeout(metaUpdateTimeout);
            metaUpdateTimeout = null;
          }
        }
      });
    },
    { threshold: 0.1 }
  );

  observer.observe(playerElement);
}

// Debounced metadata updates
function debounceUpdateMeta() {
  if (metaUpdateTimeout) clearTimeout(metaUpdateTimeout);
  metaUpdateTimeout = setTimeout(updateMeta, 200);
}

function showLoading(type = 'track') {
  if (!isVisible) return;
  if (type === 'main') {
    ui.mainLoader?.classList.remove('hidden');
  } else {
    ui.thumbLoader?.classList.remove('hidden');
    ui.thumb?.classList.add('hidden');
    if (ui.title) ui.title.textContent = 'Loading...';
    if (ui.channel) ui.channel.textContent = 'Loading track...';
  }
}

function hideLoading(type = 'track') {
  if (type === 'main') {
    ui.mainLoader?.classList.add('hidden');
  } else {
    ui.thumbLoader?.classList.add('hidden');
  }
}

// Load YouTube API
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function onYouTubeIframeAPIReady() {
  YTReady = true;
  if (document.getElementById('playerPlaceholder')) {
    document.getElementById('playerPlaceholder').textContent = 'YouTube API loaded — ready to init';
  }
  initPlayer();
}

// Event handlers
function setupEventListeners() {
  ui.play?.addEventListener('click', () => {
    if (player) {
      player.playVideo();
      ui.play.classList.add('hidden');
      ui.pause.classList.remove('hidden');
    }
  });

  ui.pause?.addEventListener('click', () => {
    if (player) {
      player.pauseVideo();
      ui.pause.classList.add('hidden');
      ui.play.classList.remove('hidden');
    }
  });

  ui.prev?.addEventListener('click', () => {
    if (player) {
      showLoading();
      player.previousVideo();
    }
  });

  ui.next?.addEventListener('click', () => {
    if (player) {
      showLoading();
      player.nextVideo();
    }
  });

  ui.shuffle?.addEventListener('click', () => {
    if (!player) return;
    try {
      const playlist = player.getPlaylist();
      if (playlist && playlist.length > 1) {
        const isShuffled = ui.shuffle.classList.contains('active');
        if (isShuffled) {
          ui.shuffle.classList.remove('active');
        } else {
          ui.shuffle.classList.add('active');
          player.setShuffle(true);
        }
      }
    } catch (e) {
      console.error('error setting up event listeners', e);
      ui.shuffle.classList.toggle('active');
    }
  });

  ui.mute?.addEventListener('click', () => {
    if (!player) return;
    if (isMuted) {
      player.unMute();
      ui.mute.textContent = '🔊';
      ui.mute.classList.remove('active');
      isMuted = false;
    } else {
      player.mute();
      ui.mute.textContent = '🔇';
      ui.mute.classList.add('active');
      isMuted = true;
    }
  });

  // Volume bar fix
  ui.volumeWrap?.addEventListener(
    'click',
    (e) => {
      if (!player) return;
      const rect = ui.volumeWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const vol = Math.floor(pct * 100);
      player.setVolume(vol);
      ui.volumeBar.style.width = `${pct * 100}%`; // FIX: use width instead of transform

      if (vol === 0 && !isMuted) {
        isMuted = true;
        ui.mute.textContent = '🔇';
        ui.mute.classList.add('active');
      } else if (vol > 0 && isMuted) {
        isMuted = false;
        ui.mute.textContent = '🔊';
        ui.mute.classList.remove('active');
      }
    },
    { passive: true }
  );
}

function initPlayer() {
  if (!YTReady) return;

  showLoading('main');

  if (player) {
    player.destroy();
    player = null;
  }

  const playerElement = document.getElementById('player');
  if (playerElement) {
    playerElement.style.display = 'block';
  }

  const placeholder = document.getElementById('playerPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }

  player = new YT.Player('player', {
    height: 1,
    width: 1,
    playerVars: {
      autoplay: 1,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: (err) => console.error('YT error', err),
    },
  });
}

function onPlayerReady(event) {
  try {
    event.target.loadPlaylist({
      list: 'PLWT9NvDdpWqyoeoRhBsnva0EBG_JHmk9R',
      listType: 'playlist',
      index: 0,
      suggestedQuality: 'small',
    });
  } catch (err) {
    console.error('loadPlaylist failed', err);
    alert('Could not load playlist — ensure the ID is correct and the playlist is public.');
    return;
  }

  player.mute();
  player.setVolume(50);

  if (ui.volumeBar) {
    ui.volumeBar.style.width = '50%';
  }

  hideLoading('main');
  showLoading();

  debounceUpdateMeta();
}

function onPlayerStateChange() {
  debounceUpdateMeta();
}

function updateMeta() {
  if (!player || !isVisible) return;
  try {
    const data = player.getVideoData();
    const videoId = data?.video_id;
    const title = data?.title || '';
    const author = data?.author || '';

    if (videoId && title) {
      const img = new Image();
      img.onload = () => {
        ui.thumb.src = img.src;
        ui.thumb.classList.remove('hidden');
      };
      img.src = `https://i.ytimg.com/vi/${videoId}/default.jpg`;

      ui.title.textContent = title;
      ui.channel.textContent = author;

      requestAnimationFrame(() => {
        checkAndApplyMarquee(ui.title, ui.titleContainer);
        checkAndApplyMarquee(ui.channel, ui.channelContainer);
      });

      hideLoading();
    }
  } catch {
    return;
  }
}

function checkAndApplyMarquee(textEl, containerEl) {
  if (!textEl || !containerEl || !isVisible) return;
  const textWidth = textEl.scrollWidth;
  const containerWidth = containerEl.clientWidth;
  textEl.classList.remove('marquee');
  if (textWidth > containerWidth) {
    textEl.style.setProperty('--container-width', containerWidth + 'px');
    textEl.classList.add('marquee');
  }
}

function setupPageVisibilityOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (metaUpdateTimeout) {
        clearTimeout(metaUpdateTimeout);
        metaUpdateTimeout = null;
      }
    }
  });
}

function setupCleanup() {
  window.addEventListener('beforeunload', () => {
    if (player) player.destroy();
    if (metaUpdateTimeout) clearTimeout(metaUpdateTimeout);
  });
}

function init() {
  initUI();
  setupEventListeners();
  setupVisibilityObserver();
  setupPageVisibilityOptimization();
  setupCleanup();
  if (!window.YT) {
    loadYouTubeAPI();
  } else if (window.YT.Player) {
    YTReady = true;
    initPlayer();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  document.querySelector('.hud').addEventListener('keydown', function (e) {
    e.stopPropagation(); // Prevent it from bubbling out
    e.preventDefault(); // Block the actual key action
  });

  const hud = document.querySelector('.hud');

  function focusTopCanvas() {
    const topCanvas = document.querySelector('canvas');
    if (topCanvas) {
      if (!topCanvas.hasAttribute('tabindex')) topCanvas.tabIndex = 0; // ensure focusable
      topCanvas.focus({ preventScroll: true });
    }
  }

  // 1) After any HUD mouse interaction, immediately return focus to canvas.
  // Use pointerup + rAF to let the click complete, then refocus.
  document.addEventListener(
    'pointerup',
    (e) => {
      if (hud && hud.contains(e.target)) {
        requestAnimationFrame(focusTopCanvas);
      }
    },
    { capture: true }
  );

  // 2) Safety net: if somehow a keydown happens while focus is in the HUD,
  // swallow it and refocus the canvas (should be rare now).
  document.addEventListener(
    'keydown',
    (e) => {
      if (!hud) return;
      const active = document.activeElement;
      if (active && hud.contains(active)) {
        e.preventDefault();
        e.stopPropagation();
        focusTopCanvas();
      }
    },
    { capture: true }
  );

  init();
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
