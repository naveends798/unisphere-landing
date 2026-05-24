document.addEventListener('DOMContentLoaded', () => {
    // ─── VAPI Configuration ───
    const VAPI_PUBLIC_KEY = '3c251d20-bdc4-446a-82e6-01d629960017';
    const VAPI_ASSISTANT_ID = 'a41f1bb5-652e-441c-a8da-ec3b65c69f3b';
    const VAPI_SDK_SRC = 'https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js';
    const DEMO_VIDEO_SRC = 'unisphere-demo-720p.mp4';
    const DEMO_VIDEO_POSTER = 'video-thumbnail-720.jpg';

    let vapi = null;
    let vapiLoadPromise = null;
    let vapiListenersAttached = false;
    let isMuted = false;
    let isCallActive = false;
    let demoVideoPreloadStarted = false;
    let demoVideoPreloadElement = null;

    // ─── DOM Elements ───
    const chatWidget = document.getElementById('chatWidget');
    const chatGreeting = document.getElementById('chatGreeting');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatAvatarBtn = document.getElementById('chatAvatarBtn');
    const voiceOverlay = document.getElementById('voiceOverlay');
    const voicePanelClose = document.getElementById('voicePanelClose');
    const startCallBtn = document.getElementById('startCallBtn');
    const muteBtn = document.getElementById('muteBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const muteIcon = document.getElementById('muteIcon');
    const mutedIcon = document.getElementById('mutedIcon');
    const voiceStatusText = document.getElementById('voiceStatusText');
    const waveContainer = document.querySelector('.voice-wave-container');
    const videoPlaceholder = document.getElementById('heroVideoPlaceholder');

    // State panels
    const voiceIdleState = document.getElementById('voiceIdleState');
    const voiceConnectingState = document.getElementById('voiceConnectingState');
    const voiceActiveState = document.getElementById('voiceActiveState');

    function loadVapiSdk() {
        if (window.vapiSDK) {
            return Promise.resolve();
        }

        if (vapiLoadPromise) return vapiLoadPromise;

        vapiLoadPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-vapi-sdk]');
            if (existingScript) {
                existingScript.addEventListener('load', resolve, { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            const sdkScript = document.createElement('script');
            sdkScript.src = VAPI_SDK_SRC;
            sdkScript.async = true;
            sdkScript.defer = true;
            sdkScript.dataset.vapiSdk = 'true';
            sdkScript.onload = () => resolve();
            sdkScript.onerror = () => reject(new Error('Failed to load voice SDK'));
            document.head.appendChild(sdkScript);
        });

        return vapiLoadPromise;
    }

    // ─── Initialize Vapi ───
    async function initVapi() {
        if (vapi) return vapi;

        try {
            await loadVapiSdk();

            if (!window.vapiSDK) {
                throw new Error('Voice SDK unavailable');
            }

            vapi = window.vapiSDK.run({
                apiKey: VAPI_PUBLIC_KEY,
                assistant: VAPI_ASSISTANT_ID,
                config: {
                    hide: true,
                    position: 'bottom-right'
                }
            });

            setupVapiListeners();
            return vapi;
        } catch (error) {
            console.error('Vapi initialization failed:', error);
            return null;
        }
    }

    // ─── Vapi Event Listeners ───
    function setupVapiListeners() {
        if (vapiListenersAttached) return;

        if (!vapi || !vapi.on) {
            return;
        }

        vapiListenersAttached = true;

        vapi.on('call-start', () => {
            isCallActive = true;
            showState('active');
            if (voiceStatusText) voiceStatusText.textContent = 'Kate is listening...';
        });

        vapi.on('call-end', () => {
            isCallActive = false;
            isMuted = false;
            resetMuteUI();
            showState('idle');
            if (waveContainer) waveContainer.classList.remove('speaking');
        });

        vapi.on('speech-start', () => {
            if (voiceStatusText) voiceStatusText.textContent = 'Kate is speaking...';
            if (waveContainer) waveContainer.classList.add('speaking');
        });

        vapi.on('speech-end', () => {
            if (voiceStatusText) voiceStatusText.textContent = 'Kate is listening...';
            if (waveContainer) waveContainer.classList.remove('speaking');
        });

        vapi.on('error', (error) => {
            console.error('Vapi error:', error);
            if (voiceStatusText) voiceStatusText.textContent = 'Connection error. Try again.';
            setTimeout(() => {
                isCallActive = false;
                showState('idle');
            }, 2500);
        });

        vapi.on('message', (message) => {
            if (message.type === 'transcript' && message.transcriptType === 'final') {
                console.log(`${message.role}: ${message.transcript}`);
            }
        });
    }

    // ─── State Management ───
    function showState(state) {
        if (!voiceIdleState || !voiceConnectingState || !voiceActiveState) return;

        voiceIdleState.classList.add('voice-state-hidden');
        voiceConnectingState.classList.add('voice-state-hidden');
        voiceActiveState.classList.add('voice-state-hidden');

        switch (state) {
            case 'idle':
                voiceIdleState.classList.remove('voice-state-hidden');
                break;
            case 'connecting':
                voiceConnectingState.classList.remove('voice-state-hidden');
                break;
            case 'active':
                voiceActiveState.classList.remove('voice-state-hidden');
                break;
        }
    }

    // ─── UI Actions ───

    // Close greeting bubble
    if (chatCloseBtn && chatGreeting) {
        chatCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatGreeting.style.opacity = '0';
            chatGreeting.style.transform = 'translateY(10px)';
            chatGreeting.style.pointerEvents = 'none';
            setTimeout(() => {
                chatGreeting.style.display = 'none';
            }, 300);
        });
    }

    // Open voice panel when clicking avatar
    if (chatAvatarBtn) {
        chatAvatarBtn.addEventListener('click', () => {
            openVoicePanel();
        });
    }

    // Also open if clicking the greeting text
    if (chatGreeting) {
        chatGreeting.addEventListener('click', (e) => {
            if (e.target.classList.contains('chat-close')) return;
            openVoicePanel();
        });
    }

    function openVoicePanel() {
        if (voiceOverlay) voiceOverlay.classList.add('active');
        if (chatWidget) {
            chatWidget.style.opacity = '0';
            chatWidget.style.pointerEvents = 'none';
        }
        // Hide greeting
        if (chatGreeting) {
            chatGreeting.style.display = 'none';
        }
        initVapi();
    }

    function closeVoicePanel() {
        // If a call is active, end it first
        if (isCallActive && vapi) {
            try {
                if (vapi.stop) vapi.stop();
                else if (vapi.end) vapi.end();
            } catch(e) {
                console.log('Call end error:', e);
            }
        }
        if (voiceOverlay) voiceOverlay.classList.remove('active');
        setTimeout(() => {
            if (chatWidget) {
                chatWidget.style.opacity = '1';
                chatWidget.style.pointerEvents = 'auto';
            }
            showState('idle');
        }, 400);
    }

    // Close panel
    if (voicePanelClose) {
        voicePanelClose.addEventListener('click', closeVoicePanel);
    }

    // Click outside panel to close
    if (voiceOverlay) {
        voiceOverlay.addEventListener('click', (e) => {
            const panel = document.querySelector('.voice-panel');
            if (panel && !panel.contains(e.target)) {
                closeVoicePanel();
            }
        });
    }

    // Start call
    if (startCallBtn) {
        startCallBtn.addEventListener('click', async () => {
            showState('connecting');
            const activeVapi = await initVapi();

            try {
                if (!activeVapi) {
                    throw new Error('Voice SDK not ready');
                }

                // Use Vapi's start method
                if (activeVapi.start) {
                    await activeVapi.start(VAPI_ASSISTANT_ID);
                } else if (activeVapi.call) {
                    // Some versions use .call()
                    activeVapi.call();
                    // Simulate entering active state after a delay
                    setTimeout(() => {
                        isCallActive = true;
                        showState('active');
                    }, 3000);
                }
            } catch (err) {
                console.error('Failed to start call:', err);
                const connectPrompt = voiceConnectingState.querySelector('.voice-prompt');
                if (connectPrompt) {
                    connectPrompt.textContent = 'Failed to connect. Please try again.';
                }
                setTimeout(() => {
                    showState('idle');
                    if (connectPrompt) {
                        connectPrompt.textContent = 'Connecting to Kate...';
                    }
                }, 2500);
            }
        });
    }

    // Mute toggle
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (!vapi || !isCallActive) return;
            isMuted = !isMuted;
            if (vapi.setMuted) {
                vapi.setMuted(isMuted);
            }
            updateMuteUI();
        });
    }

    function updateMuteUI() {
        if (isMuted) {
            muteBtn.classList.add('muted');
            muteIcon.classList.add('voice-state-hidden');
            mutedIcon.classList.remove('voice-state-hidden');
        } else {
            resetMuteUI();
        }
    }

    function resetMuteUI() {
        muteBtn.classList.remove('muted');
        muteIcon.classList.remove('voice-state-hidden');
        mutedIcon.classList.add('voice-state-hidden');
    }

    // End call
    if (endCallBtn) {
        endCallBtn.addEventListener('click', () => {
            if (vapi && isCallActive) {
                try {
                    if (vapi.stop) vapi.stop();
                    else if (vapi.end) vapi.end();
                } catch(e) {
                    console.log('End call error:', e);
                }
                isCallActive = false;
                isMuted = false;
                resetMuteUI();
                showState('idle');
                if (waveContainer) waveContainer.classList.remove('speaking');
            }
        });
    }

    function preloadDemoVideo() {
        if (demoVideoPreloadStarted) return;
        demoVideoPreloadStarted = true;

        demoVideoPreloadElement = document.createElement('video');
        demoVideoPreloadElement.src = DEMO_VIDEO_SRC;
        demoVideoPreloadElement.preload = 'metadata';
        demoVideoPreloadElement.muted = true;
        demoVideoPreloadElement.load();
    }

    function playDemoVideo() {
        if (!videoPlaceholder || videoPlaceholder.classList.contains('is-playing')) return;

        const video = document.createElement('video');
        video.src = DEMO_VIDEO_SRC;
        video.poster = DEMO_VIDEO_POSTER;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.width = 1280;
        video.height = 720;
        video.className = 'hero-inline-video';

        videoPlaceholder.classList.add('is-playing');
        videoPlaceholder.removeAttribute('role');
        videoPlaceholder.removeAttribute('tabindex');
        videoPlaceholder.replaceChildren(video);

        video.play().catch(() => {
            video.controls = true;
        });
    }

    if (videoPlaceholder) {
        videoPlaceholder.addEventListener('pointerenter', preloadDemoVideo, { once: true });
        videoPlaceholder.addEventListener('touchstart', preloadDemoVideo, { once: true, passive: true });
        videoPlaceholder.addEventListener('focus', preloadDemoVideo, { once: true });
        videoPlaceholder.addEventListener('click', playDemoVideo);
        videoPlaceholder.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                playDemoVideo();
            }
        });
    }

    // ─── FAQ Accordion ───
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        if (!questionBtn || !answer) return;
        
        questionBtn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all others
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherAnswer = otherItem.querySelector('.faq-answer');
                if (otherAnswer) otherAnswer.style.maxHeight = null;
            });
            
            // Toggle current
            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });

    // ─── Scroll Reveal (IntersectionObserver) ───
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Once revealed, stop observing for performance
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    }
});
