document.addEventListener('DOMContentLoaded', () => {
    // ─── VAPI Configuration ───
    const VAPI_PUBLIC_KEY = '3c251d20-bdc4-446a-82e6-01d629960017';
    const VAPI_ASSISTANT_ID = 'a41f1bb5-652e-441c-a8da-ec3b65c69f3b';

    let vapi = null;
    let isMuted = false;
    let isCallActive = false;

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

    // State panels
    const voiceIdleState = document.getElementById('voiceIdleState');
    const voiceConnectingState = document.getElementById('voiceConnectingState');
    const voiceActiveState = document.getElementById('voiceActiveState');

    // ─── Initialize Vapi ───
    function initVapi() {
        // The Vapi HTML script tag exposes window.vapiSDK
        // We run it with our config but hide its default button
        if (window.vapiSDK) {
            vapiInstance = window.vapiSDK.run({
                apiKey: VAPI_PUBLIC_KEY,
                assistant: VAPI_ASSISTANT_ID,
                config: {
                    hide: true,           // Hide the default Vapi button entirely
                    position: 'bottom-right'
                }
            });
            vapi = vapiInstance;
            setupVapiListeners();
            console.log('✅ Vapi initialized with custom UI');
        } else if (window._vapiSDKReady === undefined) {
            // SDK hasn't loaded yet, retry
            setTimeout(initVapi, 500);
        } else {
            setTimeout(initVapi, 300);
        }
    }

    // ─── Vapi Event Listeners ───
    function setupVapiListeners() {
        if (!vapi || !vapi.on) {
            console.log('ℹ️ Vapi instance does not support .on events (using HTML tag mode)');
            return;
        }

        vapi.on('call-start', () => {
            console.log('📞 Call connected');
            isCallActive = true;
            showState('active');
            voiceStatusText.textContent = 'Kate is listening...';
        });

        vapi.on('call-end', () => {
            console.log('📞 Call ended');
            isCallActive = false;
            isMuted = false;
            resetMuteUI();
            showState('idle');
            if (waveContainer) waveContainer.classList.remove('speaking');
        });

        vapi.on('speech-start', () => {
            voiceStatusText.textContent = 'Kate is speaking...';
            if (waveContainer) waveContainer.classList.add('speaking');
        });

        vapi.on('speech-end', () => {
            voiceStatusText.textContent = 'Kate is listening...';
            if (waveContainer) waveContainer.classList.remove('speaking');
        });

        vapi.on('error', (error) => {
            console.error('❌ Vapi error:', error);
            voiceStatusText.textContent = 'Connection error. Try again.';
            setTimeout(() => {
                isCallActive = false;
                showState('idle');
            }, 2500);
        });

        vapi.on('message', (message) => {
            if (message.type === 'transcript' && message.transcriptType === 'final') {
                console.log(`💬 ${message.role}: ${message.transcript}`);
            }
        });
    }

    // ─── State Management ───
    function showState(state) {
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
        voiceOverlay.classList.add('active');
        chatWidget.style.opacity = '0';
        chatWidget.style.pointerEvents = 'none';
        // Hide greeting
        if (chatGreeting) {
            chatGreeting.style.display = 'none';
        }
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
        voiceOverlay.classList.remove('active');
        setTimeout(() => {
            chatWidget.style.opacity = '1';
            chatWidget.style.pointerEvents = 'auto';
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
            if (!vapi) {
                console.error('Vapi not initialized yet');
                // Try to initialize
                initVapi();
                return;
            }
            try {
                showState('connecting');
                // Use Vapi's start method
                if (vapi.start) {
                    await vapi.start(VAPI_ASSISTANT_ID);
                } else if (vapi.call) {
                    // Some versions use .call()
                    vapi.call();
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

    // ─── FAQ Accordion ───
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        
        questionBtn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all others
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                otherItem.querySelector('.faq-answer').style.maxHeight = null;
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

    // ─── Initialize ───
    // Wait a bit for the Vapi SDK script to load
    setTimeout(initVapi, 1000);
});
