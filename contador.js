async function contador(){
    await aguardarElemento('.questoes-navbar')
    let elementos = document.querySelector('[id*=pulaBlocos_contador]')
    if (elementos){
        [...document.querySelectorAll('[id*=pulaBlocos_contador]')].map(d=> d.remove())
    }    
    if (document.querySelector('banner-slot')) {
        [...document.querySelectorAll('banner-slot')].map(d=> d.remove());
        observer1.disconnect();
    }
    let contador = await obterArmazenamento('pulaBlocosContador')
    let segundosRestantes = contador?.segundos || 15 * 60
    let tempoMinutos = Math.floor(segundosRestantes / 60);
    let intervaloContador = contador?.rodando ? setInterval(tickContador, 1000) : null;
    let contadorRodando = contador?.rodando || false
    relatar(contador)

    function formatarTempo(segundos) {
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = (segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function piscarBackground() {
        const corOriginal = document.body.style.backgroundColor;
        let piscadas = 0;
        const intervalo = setInterval(() => {
        if (piscadas >= 6) {
            clearInterval(intervalo);
            document.body.style.backgroundColor = corOriginal;
            return;
        }
        document.body.style.backgroundColor = piscadas % 2 === 0 ? '#ff0000' : corOriginal;
        piscadas++;
        }, 500);

        // Descomente o bloco abaixo caso o piscar do background não funcione no site:

        const aviso = document.createElement('div');
        aviso.textContent = 'Tempo encerrado';
        aviso.id = 'pulaBlocos_contador_aviso'
        Object.assign(aviso.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '999999',
        background: '#ff0000',
        color: '#fff',
        padding: '24px 40px',
        borderRadius: '10px',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        });
        aviso.addEventListener('click', () => aviso.remove());
        document.body.appendChild(aviso);

    }

    function tickContador() {
        if (segundosRestantes <= 0) {
        clearInterval(intervaloContador);
        intervaloContador = null;
        contadorRodando = false;
        armazenar({pulaBlocosContador: {rodando: contadorRodando, segundos: 15 * 60}})
        atualizarDisplayContador();
        btnPlay.style.color = '#fff';
        btnPlay.style.background = '#1e3a5f';
        piscarBackground();
        return;
        }
        segundosRestantes--;
        armazenar({pulaBlocosContador: {rodando: contadorRodando, segundos: segundosRestantes}})
        atualizarDisplayContador();
    }

    function atualizarDisplayContador() {
        spanTempo.textContent = formatarTempo(segundosRestantes);
        if (segundosRestantes <= 60 && contadorRodando) {
        spanTempo.style.color = '#e53935';
        } else {
        spanTempo.style.color = '#fff';
        }
    }

    function iniciarOuPausar() {
        if (contadorRodando) {
        clearInterval(intervaloContador);
        intervaloContador = null;
        contadorRodando = false;
        armazenar({pulaBlocosContador: {rodando: contadorRodando, segundos: segundosRestantes}})
        btnPlay.innerHTML = '<i style="font-size:16px;line-height:1">▶</i>';
        btnPlay.title = 'Iniciar contagem';
        } else {
        if (segundosRestantes <= 0) {
            segundosRestantes = tempoMinutos * 60;
            atualizarDisplayContador();
        }
        contadorRodando = true;
        armazenar({pulaBlocosContador: {rodando: contadorRodando, segundos: segundosRestantes}})
        btnPlay.innerHTML = '<i style="font-size:16px;line-height:1">⏸</i>';
        btnPlay.title = 'Pausar contagem';
        intervaloContador = setInterval(tickContador, 1000);
        }
    }

    function abrirEdicaoTempo() {
        if (contadorRodando) return;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '999';
        input.value = tempoMinutos;
        input.id = 'pulaBlocos_contador_input'
        Object.assign(input.style, {
        position: 'fixed',
        top: '95px',
        right: '16px',
        zIndex: '10000',
        width: '70px',
        padding: '4px 8px',
        fontSize: '14px',
        border: '2px solid #1e3a5f',
        borderRadius: '6px',
        textAlign: 'center',
        });
        document.body.appendChild(input);
        input.focus();
        input.select();

        function confirmar() {
        const val = parseInt(input.value);
        if (!isNaN(val) && val > 0) {
            tempoMinutos = val;
            segundosRestantes = tempoMinutos * 60;
            atualizarDisplayContador();
        }
        input.remove();
        }
        input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmar();
        if (e.key === 'Escape') input.remove();
        });
        input.addEventListener('blur', confirmar);
    }

    const estiloBase = {
        position: 'fixed',
        top: '60px',
        zIndex: '9999',
        border: 'none',
        fontWeight: 'bold',
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    };

    // Botão placar
    const btnPlacar = document.createElement('button');
    btnPlacar.id = 'pulaBlocos_contador_botaoPlacar';
    btnPlacar.textContent = 'Placar';
    btnPlacar.title = 'Clique para contar e copiar o resultado';
    Object.assign(btnPlacar.style, estiloBase, {
        right: '140px',
        padding: '6px 14px',
        background: '#1e3a5f',
        color: '#fff',
        borderRadius: '6px',
    });

    // Display do tempo (clicável para editar)
    const spanTempo = document.createElement('span');
    spanTempo.textContent = formatarTempo(segundosRestantes);
    spanTempo.title = 'Clique para editar o tempo (em minutos)';
    spanTempo.id = 'pulaBlocos_contador_span';
    
    Object.assign(spanTempo.style, {
        position: 'fixed',
        top: '60px',
        right: '78px',
        zIndex: '9999',
        padding: '6px 10px',
        background: '#1e3a5f',
        color: '#fff',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: '14px',
        borderRadius: '6px 0 0 6px',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        userSelect: 'none',
    });

    // Botão play/pause
    const btnPlay = document.createElement('button');
    btnPlay.innerHTML = '<i style="font-size:16px;line-height:1">▶</i>';
    btnPlay.title = 'Iniciar contagem';
    btnPlay.id = 'pulaBlocos_contador_botao'
    Object.assign(btnPlay.style, estiloBase, {
        right: '52px',
        padding: '6px 10px',
        background: '#1e3a5f',
        color: '#fff',
        borderRadius: '0 6px 6px 0',
        borderLeft: '1px solid rgba(255,255,255,0.2)',
    });

    btnPlacar.addEventListener('click', () => {
        let certas = 0;
        let erradas = 0;
        document.querySelectorAll('span.text-success').forEach(el => {
        if (el.innerText === 'Certa!') certas++;
        });
        document.querySelectorAll('span.text-error').forEach(el => {
        if (el.innerText === 'Errada!') erradas++;
        });
        const total = certas + erradas;
        if (total === 0) {
        btnPlacar.textContent = 'Nenhuma resposta ainda';
        btnPlacar.style.background = '#888';
        setTimeout(() => {
            btnPlacar.textContent = 'Placar';
            btnPlacar.style.background = '#1e3a5f';
        }, 2000);
        return;
        }
        const placar = `${certas}/${total}`;
        btnPlacar.textContent = placar;
        btnPlacar.style.background = '#2e7d32';
        navigator.clipboard.writeText(`=${placar}`).then(() => {
        btnPlacar.title = `Copiado: =${placar}`;
        });
    });

    spanTempo.addEventListener('click', abrirEdicaoTempo);
    btnPlay.addEventListener('click', iniciarOuPausar);

    function criarWidget() {
        
        const header = document.querySelector('header.questoes-navbar');
        document.body.appendChild(btnPlacar);
        document.body.appendChild(spanTempo);
        document.body.appendChild(btnPlay);
    }

    //const observer = new MutationObserver(() => {
    //    if (document.querySelector('header.questoes-navbar')) {
    //    criarWidget();
    //    observer.disconnect();
    //    }
    //});
    //observer.observe(document.body, { childList: true, subtree: true });

    criarWidget()
    
}

function iniciarContador(){
    if (!location.origin.includes(PAGINAS.questoes)) return
    contador()
}

iniciarContador()