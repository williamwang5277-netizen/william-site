/* Per-page music. Candidate embeds are tried in order when a source is unavailable. */
(function () {
  'use strict';
  var tracks = {
    about: { title: 'Strawberry Lemonade', artist: 'Purrple Cat', videos: ['1b2tW9JMSfQ'], start: 202, end: 358 },
    visual: { title: 'Ariana', artist: 'Tony Anderson', videos: ['ciqRQJqfQBA'] },
    music: { title: 'Rise Up', artist: 'Imagine Dragons', videos: ['JHQ1YiPCWXc'], start: 180, end: 240, edition: 'Live · March Madness 2018' },
    ai: { title: 'Resonance', artist: 'HOME', videos: ['8GW6sLrK40k'] },
    people: { title: 'Aeroplane', artist: 'Zach Bryan', videos: ['i67_2rHNQGE'], edition: 'Early recording · 89-second clip' },
    rowing: { title: 'Thunder', artist: 'Imagine Dragons', videos: ['4AqjqOqNrjw'], edition: 'Official studio audio · listen on YouTube', externalOnly: true }
  };
  var dock = document.getElementById('soundtrack');
  var toggle = document.getElementById('soundToggle');
  var title = document.getElementById('soundTitle');
  var status = document.getElementById('soundStatus');
  var player, ready = false, apiPromise, initTimer, loadTimer, resolveReady, rejectReady;
  var current = '', indexes = {}, generation = 0, enabled = true, playing = false, waitingForGesture = true, loadedVideo = '', level = 22;
  try { var stored = localStorage.getItem('william-sound-volume'); if (stored !== null && isFinite(Number(stored))) level = Math.max(0, Math.min(100, Number(stored))); } catch (_) {}
  function track() { return tracks[current] || tracks.about; }
  function video() { return track().videos[indexes[current] || 0]; }
  function setStatus(text) { status.textContent = text; }
  function render() {
    toggle.setAttribute('aria-label', track().externalOnly ? 'Listen to Thunder on YouTube' : enabled ? 'Pause soundtrack' : 'Play soundtrack');
    toggle.setAttribute('aria-pressed', String(enabled && !track().externalOnly));
    toggle.title = track().externalOnly ? 'Open the official studio audio on YouTube' : enabled ? 'Pause music' : 'Play music';
    dock.classList.toggle('is-playing', playing);
  }
  function updateLink() {
    title.href = 'https://www.youtube.com/watch?v=' + video() + (track().start ? '&t=' + track().start + 's' : '');
    title.title = track().title + ' — ' + track().artist + (track().edition ? ' · ' + track().edition : '') + ' · Open on YouTube';
  }
  function pause() {
    generation++; enabled = playing = waitingForGesture = false;
    clearTimeout(loadTimer);
    if (ready) player.pauseVideo();
    dock.classList.remove('is-loading');
    setStatus('Music paused'); render();
  }
  function fail(message) {
    pause(); dock.classList.add('has-error');
    setStatus(message); toggle.title = message + ' Click to retry.';
  }
  function retrySource(code) {
    if (!enabled) return;
    console.warn('Soundtrack source unavailable:', current, video(), code);
    clearTimeout(loadTimer);
    var next = (indexes[current] || 0) + 1;
    if (next < track().videos.length) {
      indexes[current] = next; updateLink();
      play(true);
    } else { indexes[current] = 0; updateLink(); fail('Music unavailable here. Click the song name to listen on YouTube.'); }
  }
  function youtube() {
    if (ready) return Promise.resolve(player);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      resolveReady = resolve; rejectReady = reject;
      initTimer = setTimeout(function () {
        resolveReady = rejectReady = null;
        if (player) player.destroy();
        player = null; ready = false; apiPromise = null;
        reject(new Error('YouTube could not load. Click the song name to listen.'));
      }, 20000);
      function create() {
        if (!resolveReady || player) return;
        if (!document.getElementById('soundVideo')) {
          var host = document.createElement('div'); host.id = 'soundVideo';
          document.getElementById('soundVideoWrap').appendChild(host);
        }
        player = new YT.Player('soundVideo', {
          videoId: video(),
          width: 320, height: 200, host: 'https://www.youtube-nocookie.com',
          playerVars: { playsinline: 1, controls: 1, origin: location.origin },
          events: {
            onReady: function () {
              clearTimeout(initTimer); ready = true; player.setVolume(level);
              var done = resolveReady; resolveReady = rejectReady = null;
              if (done) done(player);
              player.getIframe().setAttribute('tabindex', '-1');
            },
            onStateChange: function (event) {
              var id = (player.getVideoData() || {}).video_id;
              if (id && id !== video()) return;
              if (event.data === YT.PlayerState.PLAYING) {
                if (!enabled) { player.pauseVideo(); return; }
                clearTimeout(loadTimer); playing = true; waitingForGesture = false;
                dock.classList.remove('is-loading', 'has-error');
                setStatus('Playing ' + track().title + ' by ' + track().artist);
              } else if (event.data === YT.PlayerState.ENDED && enabled) {
                player.seekTo(track().start || 0, true); player.playVideo();
              } else { playing = false; }
              render();
            },
            onError: function (event) {
              if (!ready) return;
              var id = (player.getVideoData() || {}).video_id;
              if (id && id !== video()) return;
              retrySource(event.data);
            },
            onAutoplayBlocked: function () {
              if (!enabled || track().externalOnly) return;
              pause(); waitingForGesture = true;
              setStatus('Tap the page or music button to start music.');
              toggle.title = 'Tap the page or music button to start music';
            }
          }
        });
      }
      if (window.YT && YT.Player) create();
      else {
        window.onYouTubeIframeAPIReady = create;
        var previous = document.getElementById('soundYoutubeApi'); if (previous) previous.remove();
        var script = document.createElement('script'); script.id = 'soundYoutubeApi'; script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = function () {
          clearTimeout(initTimer); apiPromise = null;
          var failed = rejectReady; resolveReady = rejectReady = null;
          if (failed) failed(new Error('YouTube could not load. Click the song name to listen.'));
        };
        document.head.appendChild(script);
      }
    });
    return apiPromise;
  }
  function play(restart) {
    enabled = true; playing = false;
    var token = ++generation, selected = track(), selectedVideo = video();
    dock.classList.remove('has-error'); dock.classList.add('is-loading');
    setStatus('Loading ' + selected.title); render();
    function start() {
      if (token !== generation || !enabled) return;
      player.setVolume(level);
      clearTimeout(loadTimer);
      loadTimer = setTimeout(function () { if (token === generation && enabled && !playing) retrySource('timeout'); }, 15000);
      if (restart || loadedVideo !== selectedVideo) {
        loadedVideo = selectedVideo;
        player.loadVideoById({ videoId: selectedVideo, startSeconds: selected.start || 0, endSeconds: selected.end });
      } else player.playVideo();
    }
    function failed(error) { if (token === generation) fail(error.message); }
    // Use the ready player immediately so a click retains browser activation.
    if (ready) { try { start(); } catch (error) { failed(error); } }
    else youtube().then(start).catch(failed);
  }
  function selectPage(id) {
    id = tracks[id] ? id : 'about';
    if (id === current) return;
    var resume = enabled;
    generation++; clearTimeout(loadTimer); current = id; playing = false;
    if (ready) player.stopVideo();
    title.textContent = track().title; updateLink(); dock.dataset.page = id;
    dock.classList.remove('has-error', 'is-loading');
    setStatus(track().externalOnly ? 'Studio audio is available on YouTube. Click the song name or music button.' : resume ? 'Loading ' + track().title : 'Sound off · tap the music button'); render();
    if (resume && !track().externalOnly) play(true);
  }
  toggle.addEventListener('click', function () {
    if (track().externalOnly) { pause(); window.open(title.href, '_blank', 'noopener,noreferrer'); }
    else if (enabled) pause();
    else play(loadedVideo !== video());
  });
  title.addEventListener('click', pause);
  function startAfterGesture(event) {
    if (!waitingForGesture || !ready || playing || track().externalOnly) return;
    if (event.target && dock.contains(event.target)) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    waitingForGesture = false;
    play(loadedVideo !== video());
  }
  window.addEventListener('click', startAfterGesture);
  window.addEventListener('keydown', startAfterGesture);
  setInterval(function () {
    if (!enabled || !ready || !playing || !track().end) return;
    if (player.getCurrentTime() >= track().end - 0.15) { player.seekTo(track().start || 0, true); player.playVideo(); }
  }, 500);
  window.addEventListener('portfolio:page', function (event) { selectPage(event.detail); });
  var active = document.querySelector('.page.on'); selectPage(active ? active.id.replace('p-', '') : 'about');
})();
