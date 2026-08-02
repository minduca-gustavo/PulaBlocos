async function iniciaGran() {
    if (!location.origin.includes(PAGINAS.questoes)) return
    let cabecalho = await aguardarElemento('header')
    if (!cabecalho) return
    let divRemove = document.querySelectorAll('[id*="pulaBlocos"]')
    for (d of divRemove){
        d.remove()
    }
    
    let divTitulo = criaDiv({
        id: 'pulaBlocos_div_titulo',
        ancestral: '.questoes-navbar',
        gap: '50px',
        rowColumn: 'row'
    })
    criaTitulo({ id: 'pulaBlocos_materiaAtual', texto: 'Matéria: —', ancestral: 'pulaBlocos_div_titulo' })
    criaTitulo({ id: 'pulaBlocos_assuntoAtual', texto: 'Assunto atual: —', ancestral: 'pulaBlocos_div_titulo' })
    await atualizarCabecalho()
    await renderizarSelecao()

    let div = criaDiv({
        id: 'pulaBlocos_div',
        ancestral: '.questoes-navbar',
        gap: '4px'
    })
    let t = 0
    let largura = Math.floor(100 / [Object.entries(PAGINAS.tiposDeBotoes)].length) + '%'
    let modoArmazenado = await obterArmazenamento('pulaBlocos') || {}
    let modo = modoArmazenado.modo || 'facilCertoErrado'
    relatar('modo', modo, 'roxo')

    let mapaFuncoes = {
        gerenciar,
        alteraTipo,
        avancar,
        registrar
    }
    for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
        //console.log(nomeTipo, dados)
        let tipoId = 'pulaBlocos_' + nomeTipo
        let [funcao, parametros] = ['', {}]
        let cor = modo == nomeTipo ? '#d62839' : 'primaria'
        if (dados?.url){
            funcao = 'alteraTipo'
            parametros = [dados?.url, nomeTipo, tipoId]
        } else if (dados?.materiaOuAssunto) {
            funcao = 'avancar'
            parametros = [dados?.materiaOuAssunto]
        } else if (dados?.acao) {
            funcao = dados?.acao
            parametros = []
        }
        let botao = criaBotao({
            id: tipoId,
            texto: dados.texto,
            ancestral: '#pulaBlocos_div',
            cor: dados?.url ? cor : '#386641',
            acao: () => mapaFuncoes[funcao](...parametros),
        })
        botao.style.width = largura
        botao.style.maxWidth = '185px'
        t++
    }
    

    // Uma "unidade" é ou um assunto avulso, ou um bloco inteiro (tratado
    // como se fosse um único passo pra fins de navegação). 'excluir' nunca
    // vira unidade — some da sequência inteiramente.
    // 'trilha' pode ser a própria matéria (trilha-base) ou um label dela —
    // as duas têm a mesma forma: assuntos/blocos/excluir/posicaoAtual.
    function assuntoDaLinha(trilha, linha) {
        let alvo = linha.trim()
        let assuntos = trilha.assuntos || []
        // tenta igual primeiro; se não bater, tira o primeiro segmento do
        // índice (ex.: "48.6.4.2.10." → "6.4.2.10.") — é assim que o índice
        // aparece no site, sem esse prefixo que só existe na árvore da API
        return assuntos.find(a => (a.indice + ' ' + a.nome) === alvo)
            || assuntos.find(a => (a.indice.replace(/^\d+\./, '') + ' ' + a.nome) === alvo)
    }

    function idDaLinha(trilha, linha) {
        return assuntoDaLinha(trilha, linha)?.id
    }

    function indiceDaLinha(linha) {
        return (linha.trim().match(/^\S+/) || [''])[0]
    }

    function textoFaixa(rotulo, linhas) {
        if (!linhas?.length) return rotulo
        let primeiro = indiceDaLinha(linhas[0])
        let ultimo = indiceDaLinha(linhas[linhas.length - 1])
        return primeiro === ultimo ? `${rotulo} ${primeiro}` : `${rotulo} ${primeiro} a ${ultimo}`
    }

    function slug(texto) {
        return normalizar(texto).replace(/[^a-z0-9]+/g, '_')
    }

    function montarUnidades(trilha) {
        let excluidos = new Set(
            (trilha.excluir || []).flat().map(linha => idDaLinha(trilha, linha)).filter(Boolean)
        )
        let inicioDeBloco = new Map() // id do primeiro assunto do bloco → ids do bloco inteiro
        ;(trilha.blocos || []).forEach(bloco => {
            let ids = bloco.map(linha => idDaLinha(trilha, linha)).filter(Boolean)
            if (ids.length) inicioDeBloco.set(ids[0], ids)
        })

        let unidades = []
        let assuntosOrdenados = trilha.assuntos || []
        let i = 0
        while (i < assuntosOrdenados.length) {
            let assunto = assuntosOrdenados[i]
            if (excluidos.has(assunto.id)) { i++; continue }
            let bloco = inicioDeBloco.get(assunto.id)
            if (bloco) {
                unidades.push({ ids: bloco, ultimoId: bloco[bloco.length - 1] })
                i += bloco.length // bloco é contíguo, pula ele inteiro
            } else {
                unidades.push({ ids: [assunto.id], ultimoId: assunto.id })
                i++
            }
        }
        return unidades
    }

    // Acha a matéria e resolve a trilha corrente (base ou um label dela) a
    // partir de dados.atual = { materia, label }. Retorna null se a matéria
    // não existe mais (foi excluída) ou o label sumiu.
    function resolverTrilha(dados, atual) {
        let materia = (dados.materias || []).find(m => m.nome === atual?.materia)
        if (!materia) return null
        // migração transparente: storage antigo guardava o assunto atual
        // como texto solto (materia.assunto), não como id (posicaoAtual)
        if (materia.posicaoAtual == null && materia.assunto) {
            materia.posicaoAtual = idDaLinha(materia, materia.assunto)
        }
        if (!atual?.label) return { materia, trilha: materia }
        let label = (materia.labels || []).find(l => l.nome === atual.label)
        if (!label) return null
        return { materia, trilha: label }
    }

    // Cola assuntos no textarea, dá um nome, clica: vira uma "matéria dentro
    // da matéria" — com assuntos copiados (não referência), sua própria
    // trilha (blocos/excluir/posicaoAtual), e entra no excluir da
    // matéria-base (pra não rodar duas vezes) e no fim de pulaBlocos.ordem.
    async function criarLabel(seletorNome, seletorInput) {
        let nomeLabel = (document.querySelector(seletorNome)?.value || '').trim()
        if (!nomeLabel) { avisar('digite um nome pro label', 'erro'); return }

        let elemento = document.querySelector(seletorInput)
        let linhas = elemento.value.split('\n').map(d => d.trim()).filter(d => /^\d+(\.\d+)*\./.test(d))
        if (!linhas.length) { avisar('nada colado pra virar label', 'erro'); return }

        let dados = await obterArmazenamento('pulaBlocos')
        if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
        let indiceMateria = dados.materias.findIndex(d => normalizar(d.nome) == normalizar(dados?.atual?.materia))
        if (indiceMateria < 0) { avisar('matéria atual não encontrada em pulaBlocos', 'erro'); return }
        let materia = dados.materias[indiceMateria]

        if ((materia.labels || []).some(l => normalizar(l.nome) === normalizar(nomeLabel))) {
            avisar('já existe um label com esse nome nessa matéria', 'erro')
            return
        }

        let assuntosEncontrados = linhas.map(linha => assuntoDaLinha(materia, linha)).filter(Boolean)
        if (!assuntosEncontrados.length) {
            avisar('nenhuma linha colada bateu com a árvore dessa matéria', 'erro')
            return
        }

        if (!materia.labels) materia.labels = []
        materia.labels.push({
            nome: nomeLabel,
            assuntos: assuntosEncontrados, // cópia, não referência
            blocos: [],
            excluir: [],
            posicaoAtual: undefined,
            linhasOriginais: linhas, // texto exato colado — usado pra achar/desfazer sem ambiguidade depois
        })

        if (!materia.excluir) materia.excluir = []
        materia.excluir.push(linhas)

        if (!dados.ordem) dados.ordem = []
        dados.ordem.push({ materia: materia.nome, label: nomeLabel })

        await armazenar({ pulaBlocos: dados })
        elemento.value = ''
        document.querySelector(seletorNome).value = ''
        avisar('label "' + nomeLabel + '" criado (' + assuntosEncontrados.length + ' assuntos)', 'sucesso')
    }

    // Some com o label inteiro (blocos/excluir dele não migram, só somem) e
    // devolve os assuntos dele pra rotação da matéria-base, tirando de
    // materia.excluir exatamente o bloco criado junto (casado por texto
    // original, não reconstruído — evita qualquer ambiguidade de índice).
    function removerLabel(dados, materia, nomeLabel) {
        let idxLabel = (materia.labels || []).findIndex(l => l.nome === nomeLabel)
        if (idxLabel < 0) return
        let label = materia.labels[idxLabel]

        if (label.linhasOriginais?.length) {
            let alvo = label.linhasOriginais.map(l => l.trim())
            let posicao = (materia.excluir || []).findIndex(bloco =>
                bloco.length === alvo.length && bloco.every((linha, i) => linha.trim() === alvo[i])
            )
            if (posicao >= 0) materia.excluir.splice(posicao, 1)
        }

        materia.labels.splice(idxLabel, 1)
        dados.ordem = (dados.ordem || []).filter(o => !(o.materia === materia.nome && o.label === nomeLabel))

        if (dados.atual?.materia === materia.nome && dados.atual?.label === nomeLabel) {
            dados.atual = { materia: materia.nome, label: null }
        }
    }

    // direcao: 'materia' (pula pra próxima matéria/label na lista de ordem)
    // | 'bloco' (avança dentro da trilha atual) | 'atuais' (fica na mesma
    // unidade, só reconsulta os ids — usado ao trocar de modo sem avançar)
    async function assuntos(direcao) {
        let dados = await obterArmazenamento('pulaBlocos')
        if (!dados?.materias?.length) return { idMateria: undefined, blocoArray: [] }

        // ordem é a lista mesclada de matérias+labels; se ainda não existe
        // (storage antigo, ou só uma matéria incluída até agora), cai pra
        // andar direto em dados.materias, ignorando labels.
        let ordem = dados.ordem?.length
            ? dados.ordem
            : dados.materias.map(m => ({ materia: m.nome, label: null }))

        // migração transparente: storage antigo guardava atual como string
        // (só o nome da matéria); o formato novo é { materia, label }
        if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
        if (!dados.atual) dados.atual = ordem[0]

        if (direcao === 'materia') {
            let indiceAtual = ordem.findIndex(o => o.materia === dados.atual.materia && o.label === dados.atual.label)
            if (indiceAtual < 0) indiceAtual = 0
            let proximoIndice = (indiceAtual + 1) % ordem.length
            dados.atual = { materia: ordem[proximoIndice].materia, label: ordem[proximoIndice].label }
        }

        let resolvido = resolverTrilha(dados, dados.atual)
        if (!resolvido) {
            // matéria/label sumiu (foi excluído) — cai pro primeiro item da ordem
            dados.atual = { materia: ordem[0].materia, label: ordem[0].label }
            resolvido = resolverTrilha(dados, dados.atual)
            if (!resolvido) return { idMateria: undefined, blocoArray: [] }
        }
        let { materia, trilha } = resolvido

        let unidades = montarUnidades(trilha)
        if (!unidades.length) {
            await armazenar({ pulaBlocos: dados })
            return { idMateria: materia.id, blocoArray: [] }
        }

        let indiceUnidade = unidades.findIndex(u => u.ids.includes(trilha.posicaoAtual))
        if (indiceUnidade < 0) indiceUnidade = 0 // nunca andou nessa trilha ainda

        if (direcao === 'bloco') {
            indiceUnidade = (indiceUnidade + 1) % unidades.length
        }

        let unidade = unidades[indiceUnidade]
        trilha.posicaoAtual = unidade.ultimoId
        await armazenar({ pulaBlocos: dados })

        relatar('assuntos:', { idMateria: materia.id, blocoArray: unidade.ids }, 'roxo')
        return { idMateria: materia.id, blocoArray: unidade.ids }
    }

    // Lê pulaBlocos e atualiza os dois textos do topo (matéria/assunto
    // atuais). 'assunto atual' é o assunto de id == posicaoAtual — que já É
    // o último do bloco, se a unidade corrente for um bloco.
    async function atualizarCabecalho() {
        let dados = await obterArmazenamento('pulaBlocos') || {}
        if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
        let resolvido = dados.atual ? resolverTrilha(dados, dados.atual) : null
        let materia = resolvido?.materia
        let trilha = resolvido?.trilha
        let assuntoAtual = trilha?.assuntos?.find(a => a.id === trilha?.posicaoAtual)

        let nomeMateria = materia?.nome || '—'
        if (dados.atual?.label) nomeMateria += ' / ' + dados.atual.label

        function textoEstatistica(acertos, total) {
            if (!total) return '' // 'se houver' — sem registro ainda, não mostra nada
            let percentual = Math.round((acertos / total) * 100)
            return ` — ${acertos}/${total} (${percentual}%)`
        }

        // soma tudo que já foi registrado nessa trilha, incluindo o ponto
        // de partida (histórico manual/importado) — mesma lógica do painel
        let totalTrilha = estatisticaTrilha(materia, trilha)
        let registroBloco = trilha?.desempenho?.[trilha?.posicaoAtual]

        let elMateria = document.getElementById('pulaBlocos_materiaAtual')
        let elAssunto = document.getElementById('pulaBlocos_assuntoAtual')
        if (elMateria) elMateria.textContent = 'Matéria: ' + nomeMateria + textoEstatistica(totalTrilha.acertos, totalTrilha.total)
        if (elAssunto) elAssunto.textContent = 'Assunto atual: ' + (assuntoAtual?.nome || '—') + textoEstatistica(registroBloco?.acertos || 0, registroBloco?.total || 0)
    }

    // ── acertos/erros por unidade (bloco/assunto) ──────────────────
    //
    // Conta certas/erradas visíveis na página agora (mesma detecção do seu
    // script de Tampermonkey). 'baselinePlacar' guarda o que já foi
    // registrado NESSE carregamento de página — reseta sozinho a cada
    // navegação (é uma variável local de iniciaGran, roda de novo a cada
    // vez que a página carrega). Só o delta (o que apareceu de novo desde
    // o último registro) entra na conta, então clicar em "Registrar"
    // mais de uma vez na mesma página não conta as mesmas respostas de novo.
    let baselinePlacar = { certas: 0, erradas: 0 }

    function contarPlacarPagina() {
        let certas = 0, erradas = 0
        document.querySelectorAll('span.text-success').forEach(el => { if (el.innerText.trim() === 'Certa!') certas++ })
        document.querySelectorAll('span.text-error').forEach(el => { if (el.innerText.trim() === 'Errada!') erradas++ })
        return { certas, erradas }
    }

    async function registrar() {
        let atual = contarPlacarPagina()
        let deltaCertas = Math.max(0, atual.certas - baselinePlacar.certas)
        let deltaErradas = Math.max(0, atual.erradas - baselinePlacar.erradas)
        baselinePlacar = atual
        if (deltaCertas === 0 && deltaErradas === 0) return

        let dados = await obterArmazenamento('pulaBlocos') || {}
        if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
        let resolvido = dados.atual ? resolverTrilha(dados, dados.atual) : null
        if (!resolvido) { relatar('sem trilha atual pra registrar', '', 'vermelho'); return }
        let { trilha } = resolvido
        if (trilha.posicaoAtual == null) { relatar('sem posição atual pra registrar', '', 'vermelho'); return }

        if (!trilha.desempenho) trilha.desempenho = {}
        let registro = trilha.desempenho[trilha.posicaoAtual] || { acertos: 0, total: 0 }
        registro.acertos += deltaCertas
        registro.total += deltaCertas + deltaErradas
        trilha.desempenho[trilha.posicaoAtual] = registro

        await armazenar({ pulaBlocos: dados })
        await atualizarCabecalho()
        relatar('registrado', { deltaCertas, deltaErradas, registro }, 'verde')
    }

    // ── seleção rápida (2 dropdowns + botão Estatísticas) ───────────

    function corPorPercentual(acertos, total) {
        if (!total) return '#8a8f98' // cinza — sem registro ainda
        let percentual = (acertos / total) * 100
        if (percentual < 65) return '#c0392b'
        if (percentual < 80) return '#e0a800'
        return '#2e7d32'
    }

    // soma tudo que já foi registrado numa trilha, incluindo o histórico
    // manual (materia.acertos/total) quando for a trilha-base
    function estatisticaTrilha(materia, trilha) {
        // acertos/total na própria trilha (matéria-base OU label) é o
        // ponto de partida — histórico de antes do registrar() existir,
        // ou importado manualmente. Cada trilha carrega o seu.
        let baseAcertos = parseInt(trilha?.acertos) || 0
        let baseTotal = parseInt(trilha?.total) || 0
        let total = { acertos: baseAcertos, total: baseTotal }
        for (let registro of Object.values(trilha?.desempenho || {})) {
            total.acertos += registro.acertos
            total.total += registro.total
        }
        return total
    }

    // Texto de uma unidade (bloco ou assunto avulso) pra exibir em listas.
    function textoUnidade(trilha, unidade) {
        if (unidade.ids.length > 1) {
            let blocoOriginal = (trilha.blocos || []).find(b => idDaLinha(trilha, b[0]) === unidade.ids[0])
            return blocoOriginal ? textoFaixa('Bloco', blocoOriginal) : ('Bloco (' + unidade.ids.length + ' assuntos)')
        }
        let assunto = (trilha.assuntos || []).find(a => a.id === unidade.ultimoId)
        return assunto ? assunto.indice.replace(/^\d+\./,'') + ' ' + assunto.nome : ('Assunto ' + unidade.ultimoId)
    }

    // 2 dropdowns (trocar matéria/label, trocar bloco) + botão que abre o
    // painel de estatísticas. Selecionar em qualquer um já navega — não
    // precisa clicar em "Atual" depois.
    async function renderizarSelecao() {
        let antigo = document.getElementById('pulaBlocos_div_selecao')
        if (antigo) antigo.remove()

        let divSelecao = criaDiv({ id: 'pulaBlocos_div_selecao', ancestral: '.questoes-navbar', gap: '8px', rowColumn: 'row' })

        let dados = await obterArmazenamento('pulaBlocos') || {}
        if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
        let ordem = dados.ordem?.length ? dados.ordem : (dados.materias || []).map(m => ({ materia: m.nome, label: null }))

        let opcoesMateria = ordem.map(o => ({
            valor: o.materia + '::' + (o.label || ''),
            texto: o.label ? (o.materia + ' / ' + o.label) : o.materia,
        }))
        let valorAtualMateria = (dados.atual?.materia || '') + '::' + (dados.atual?.label || '')

        let menuMateria = criaMenuSuspenso({
            id: 'pulaBlocos_selecaoMateria',
            ancestral: 'pulaBlocos_div_selecao',
            opcoes: opcoesMateria,
            valorInicial: valorAtualMateria,
            acao: async (valor) => {
                let [materiaEscolhida, labelEscolhido] = valor.split('::')
                let dadosAtuais = await obterArmazenamento('pulaBlocos')
                dadosAtuais.atual = { materia: materiaEscolhida, label: labelEscolhido || null }
                await armazenar({ pulaBlocos: dadosAtuais })
                await avancar('atuais')
                await renderizarSelecao()
            },
        })
        //menuMateria.style.minWidth = '200px'
        menuMateria.style.height = '100%'
        let resolvido = dados.atual ? resolverTrilha(dados, dados.atual) : null
        let unidadesAtual = resolvido ? montarUnidades(resolvido.trilha) : []
        let opcoesBloco = unidadesAtual.map(u => ({
            valor: String(u.ultimoId),
            texto: resolvido ? textoUnidade(resolvido.trilha, u) : '',
        }))
        let valorAtualBloco = String(resolvido?.trilha?.posicaoAtual ?? (unidadesAtual[0]?.ultimoId ?? ''))

        let menuBloco = criaMenuSuspenso({
            id: 'pulaBlocos_selecaoBloco',
            ancestral: 'pulaBlocos_div_selecao',
            opcoes: opcoesBloco,
            valorInicial: valorAtualBloco || 'Selecione um bloco.',
            acao: async (valor) => {
                let dadosAtuais = await obterArmazenamento('pulaBlocos')
                if (typeof dadosAtuais.atual === 'string') dadosAtuais.atual = { materia: dadosAtuais.atual, label: null }
                let resolvidoAtual = resolverTrilha(dadosAtuais, dadosAtuais.atual)
                if (!resolvidoAtual) return
                resolvidoAtual.trilha.posicaoAtual = Number(valor)
                await armazenar({ pulaBlocos: dadosAtuais })
                await avancar('atuais')
            },
        })
        //menuBloco.style.minWidth = '200px'
        menuBloco.style.height = '100%'

        let botaoEstatisticas = criaBotao({
            id: 'pulaBlocos_botaoEstatisticas',
            texto: 'Estatísticas',
            cor: 'secundaria',
            ancestral: 'pulaBlocos_div_selecao',
            acao: abrirPainelEstatisticas,
        })
        
    }

    // Painel flutuante com todas as trilhas (pulaBlocos.ordem — matérias e
    // labels como entradas independentes, sem aninhar label dentro de
    // matéria). Cada linha mostra o total (cor por faixa de %); clicar
    // expande a lista de unidades dela — montada só na hora, não ao abrir
    // o painel, pra não pesar em matérias com muito assunto solto.
    async function abrirPainelEstatisticas() {
        let existente = document.getElementById('pulaBlocos_painelEstatisticas')
        if (existente) { existente.remove(); return }

        let painel = await criaDivFlutuante({
            id: 'pulaBlocos_painelEstatisticas',
            titulo: 'Estatísticas',
            largura: '360px',
        })
        let corpoId = painel.id + '-corpo'

        let dados = await obterArmazenamento('pulaBlocos') || {}
        let ordem = dados.ordem?.length ? dados.ordem : (dados.materias || []).map(m => ({ materia: m.nome, label: null }))

        for (let entrada of ordem) {
            let materia = (dados.materias || []).find(m => m.nome === entrada.materia)
            if (!materia) continue
            let trilha = entrada.label ? (materia.labels || []).find(l => l.nome === entrada.label) : materia
            if (!trilha) continue
            let nomeExibicao = entrada.label ? (entrada.materia + ' / ' + entrada.label) : entrada.materia
            renderizarLinhaEstatistica(materia, trilha, nomeExibicao, corpoId)
        }
    }

    function renderizarLinhaEstatistica(materia, trilha, nomeExibicao, ancestralId) {
        let est = estatisticaTrilha(materia, trilha)
        let cor = corPorPercentual(est.acertos, est.total)
        let textoStats = est.total
            ? ` — ${est.acertos}/${est.total} (${Math.round(est.acertos / est.total * 100)}%)`
            : ' — sem registro'

        let idLinha = 'pulaBlocos_estat_' + slug(nomeExibicao)
        let idCorpo = idLinha + '_corpo'

        criaBotao({
            id: idLinha,
            texto: nomeExibicao + textoStats,
            cor: cor,
            ancestral: ancestralId,
            acao: () => alternarCorpoEstatistica(idCorpo, trilha),
        })

        let corpo = criaDiv({ id: idCorpo, ancestral: ancestralId, gap: '3px' })
        corpo.style.display = 'none'
        corpo.dataset.carregado = '0'
    }

    function alternarCorpoEstatistica(idCorpo, trilha) {
        let el = document.getElementById(idCorpo)
        if (!el) return

        if (el.style.display === 'none') {
            if (el.dataset.carregado !== '1') {
                let unidades = montarUnidades(trilha)
                unidades.forEach(u => {
                    let e = trilha.desempenho?.[u.ultimoId]
                    let c = corPorPercentual(e?.acertos || 0, e?.total || 0)
                    let t = textoUnidade(trilha, u) + (e?.total
                        ? ` — ${e.acertos}/${e.total} (${Math.round(e.acertos / e.total * 100)}%)`
                        : ' — sem registro')
                    let linha = criaTexto({ id: idCorpo + '_' + u.ultimoId, texto: t, ancestral: idCorpo })
                    linha.style.color = c
                    linha.style.paddingLeft = '10px'
                    linha.style.fontWeight = '600'
                })
                el.dataset.carregado = '1'
            }
            el.style.display = 'flex'
            el.style.flexDirection = 'column'
        } else {
            el.style.display = 'none'
        }
    }

    // Monta a URL do modo atualmente selecionado (pulaBlocos.modo) e navega
    // com os assuntos passados. Usada tanto por alteraTipo (troca de modo)
    // quanto por avancar (troca de matéria/bloco, mantendo o modo).
    async function navegarParaAssunto(idMateria, blocoArray) {
        if (!idMateria || !blocoArray?.length) {
            relatar('sem matéria/bloco pra navegar', { idMateria, blocoArray }, 'vermelho')
            return
        }
        let dados = await obterArmazenamento('pulaBlocos') || {}
        let modoAtual = dados.modo || 'facilCertoErrado'
        let url = PAGINAS.tiposDeBotoes[modoAtual]?.url
        if (!url) {
            relatar('não achei url pro modo atual', modoAtual, 'vermelho')
            return
        }
        let urlNavegar = url + '&assunto=' + idMateria + '%2C' + blocoArray.join('%2C')
        await navegar(urlNavegar, { novaAba: false })
        relatar('urlNavegar', urlNavegar, 'azul')
    }

    // Chamada pelos botões 'atual' / 'proximaMateria' / 'proximoBloco' —
    // avança a posição (ou não, se for 'atuais') e navega no modo vigente.
    // 'bloco'/'materia' registram o placar da página ANTES de avançar (pra
    // creditar na unidade que está sendo deixada, não na próxima).
    async function avancar(direcao) {
        if (direcao === 'bloco' || direcao === 'materia') await registrar()
        let {idMateria, blocoArray} = await assuntos(direcao)
        await atualizarCabecalho()
        await navegarParaAssunto(idMateria, blocoArray)
    }

    async function alteraTipo(url, nome, tipoId){
        await registrar()
        let dados = await obterArmazenamento('pulaBlocos')
        dados.modo = nome
        
        await armazenar({ pulaBlocos: dados })

        let {idMateria, blocoArray} = await assuntos('atuais')
        relatar ('85: ', JSON.stringify(blocoArray), 'verde')
        for (let [nomeTipo, dadosBotao] of Object.entries(PAGINAS.tiposDeBotoes)) {
            if (!dadosBotao?.url) continue
            let botao = document.querySelector('#pulaBlocos_' + nomeTipo)
            let corResolver = nomeTipo == nome ? '#d62839' : 'primaria'
            let { cor: corBase, corHover } = _ui_resolveCor(corResolver)
            botao.style.background = corBase
            _ui_hoverBotao(botao, corBase, corHover)
        }
        await atualizarCabecalho()
        await navegarParaAssunto(idMateria, blocoArray)
    }

    async function gerenciar() {
        let divAnterior = [...document.querySelectorAll('[id*=pulaBlocos_divGerenciar]')]
        if (divAnterior.length>0) {
            divAnterior.map(d=> d.remove())
            return
        }
        let divGerenciar = criaDiv({
            id: 'pulaBlocos_divGerenciar',
            ancestral: '.questoes-navbar',
            gap: '4px',
            rowColumn: 'row'
        })
        let materias = await obterArmazenamento('pulaBlocos')
        //let materiaAtual = materias?.atual ? materias?.atual : 'Selecione uma matéria.'
        let opcoes = ['Selecione uma matéria.']
        if (materias?.materias){
            for (m of materias?.materias){
                opcoes.push(m?.nome)
            }
        }
        
        let divGerenciarCorpo = criaDiv({
            id: 'pulaBlocos_divGerenciar_corpo',
            ancestral: '.questoes-navbar',
            gap: '4px',
            rowColumn: 'row'
        })
        
        //  secoes a criar:
        //  inputBlocos
        //  inputExcluir
        //  remove blocos e remove excluir
        //  
        //
        //
        let secoesGerenciar = [
            {
                nome:   'input',
                peso:   2
            },
            {
                nome:   'botoes',
                peso:   1
            },
            {
                nome:   'editar',
                peso:   2
            },
        ]
        let token = await obterArmazenamento('blocosTokenGranAuthorization') || []
        relatar('174g: ', token)
        let botaoIncluir = {
            id: 'incluirMaterias',
            acao: 'incluirMaterias',
            texto: 'Incluir matérias'
        }
        if (token.length == 0){
            // sem token capturado ainda, incluir vai dar "Não Autorizado" —
            // troca o botão por um lembrete de recarregar a página primeiro
            botaoIncluir.id = 'atualizaPagina'
            botaoIncluir.acao = 'atualizaPagina'
            botaoIncluir.texto = 'Atualiza página'
        }
        relatar('174g: ', botaoIncluir)
        let elementosGerenciar = [
            //{
            //    tipo: 'criaTitulo',
            //    id: 'tituloBlocos',
            //    texto: 'Cria blocos',
            //    coluna: 'input',
            //},
            //{
            //    tipo: 'criaTexto',
            //    id: 'tituloBlocos',
            //    texto: 'Copie e cole os assuntos para criar blocos.',
            //    coluna: 'input',
            //},
            {
                tipo: 'criaInput',
                id: 'inputSalvar',
                placeholder: 'Cole aqui + enter ou clique no botão para montar blocos.',
                acao: 'salvarExcluir',
                parametros: ['salvar', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'input'
            },
            {
                tipo: 'criaBotao',
                id: botaoIncluir.id,
                acao: botaoIncluir.acao,
                texto: botaoIncluir.texto,
                parametros: ['#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'excluirMaterias',
                acao: 'excluirMaterias',
                texto: 'Excluir matérias',
                cor: 'erro',
                parametros: ['#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'salvaBloco',
                acao: 'salvarExcluir',
                texto: 'Salvar como bloco',
                parametros: ['blocos', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'excluiAssunto',
                acao: 'salvarExcluir',
                texto: 'Excluir assuntos da "rodagem"',
                parametros: ['excluir', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaInput',
                id: 'inputNomeLabel',
                placeholder: 'Nome do label',
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'criarLabel',
                acao: 'criarLabel',
                texto: 'Criar label',
                cor: '#c98a3e',
                parametros: ['#pulaBlocos_divGerenciar_inputNomeLabel', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'reordenar',
                acao: 'reordenar',
                texto: 'Reordenar',
                cor: 'secundaria',
                parametros: ['#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'salvarDados',
                acao: 'salvarDados',
                texto: 'Salvar dados da extensão.',
                parametros: [],
                coluna: 'botoes'
            },
            {
                tipo: 'criaInputArquivo',
                id: 'carregarDados',
                acao: 'carregarDados',
                aceita: '.json,application/json',
                texto: 'Carregar dados salvos.',
                parametros: [],
                coluna: 'botoes'
            },
            //{
            //    tipo: 'criaTitulo',
            //    id: 'tituloBlocos',
            //    texto: 'Exclui assuntos',
            //    coluna: 'botoes',
            //},
            //{
            //    tipo: 'criaTexto',
            //    id: 'tituloBlocos',
            //    texto: 'Copie e cole os assuntos que devem ser excluídos, ou seja, não "rodarão".',
            //    coluna: 'botoes',
            //},
            //{
            //    tipo: 'criaInput',
            //    id: 'inputExcluir',
            //    placeholder: 'Cole aqui + enter ou clique no botão para excluir assuntos.',
            //    acao: 'salvarExcluir',
            //    parametros: ['excluir', '#pulaBlocos_divGerenciar_inputExcluir'],
            //    coluna: 'botoes'
            //},
            //{
            //    tipo: 'criaBotao',
            //    id: 'inputBotao',
            //    acao: 'salvarExcluir',
            //    texto: 'Excluir assuntos',
            //    parametros: ['excluir', '#pulaBlocos_divGerenciar_inputExcluir'],
            //    coluna: 'botoes'
            //},
            {
                tipo: 'criaTitulo',
                id: 'editarTitulo',
                ancestral: '#pulaBlocos_divGerenciar',
                texto: 'Matéria:',
                coluna: 'editarPrimeiraLinha',
            },
            {
                tipo: 'criaMenuSuspenso',
                id: 'editarMenu',
                ancestral: '#pulaBlocos_divGerenciar',
                valorInicial: 'Selecione uma matéria.',
                opcoes: opcoes,
                acao: 'editarBlocos',
                coluna: 'editarPrimeiraLinha',
            },

        ]
        let mapaFuncoesGerenciar = {
            criaTitulo,
            criaTexto,
            criaInput,
            criaBotao,
            criaMenuSuspenso,
            criaBotaoComCheckbox,
            salvarExcluir,
            incluirMaterias,
            excluirMaterias,
            criarLabel,
            reordenar,
            atualizaPagina,
            editarBlocos,
            salvarDados,
            carregarDados,
            criaInputArquivo,
        }
        let secoesTamanho = 0
        secoesGerenciar.map(d=> {secoesTamanho = secoesTamanho + d?.peso})
        console.log(secoesTamanho)
        let colunas = Math.max(...elementosGerenciar.map(d=> d.coluna))
        let larguraCalculo = Math.floor(100 / secoesTamanho)
        relatar ('larguraCalculo: ' + larguraCalculo)
        //let colunasNumero = Math.max(colunas)
        relatar ('colunas', colunas)
        for (let d of secoesGerenciar){
            //let rc = d?.nome == 'editar' ? 'row' : 'column'
            let coluna = criaDiv({
                id:'pulaBlocos_divGerenciar_coluna_' + d?.nome,
                ancestral:'pulaBlocos_divGerenciar_corpo',
                gap: '4px',
                rowColumn: 'column'
            })
            if (d?.nome == 'editar'){
                let colunaEditar = criaDiv({
                    id:'pulaBlocos_divGerenciar_coluna_editarPrimeiraLinha',
                    ancestral:'pulaBlocos_divGerenciar_coluna_editar',
                    gap: '4px',
                    rowColumn: 'row'
                })
            }
            coluna.style.width = (larguraCalculo * d?.peso) + '%'
            coluna.style.maxWidth = '600px'
            for (let m of elementosGerenciar){
                if (m?.coluna.includes(d?.nome)){
                    let acao = m?.acao
                    let parametros = m?.parametros || []
                    let funcao = m?.tipo
                    let elemento = mapaFuncoesGerenciar[funcao]({
                        texto: m?.texto,
                        id: 'pulaBlocos_divGerenciar_' + m?.id,
                        ancestral: 'pulaBlocos_divGerenciar_coluna_' + m?.coluna,
                        placeholder: m?.placeholder,
                        valorInicial: m?.valorInicial,
                        aceita: m?.aceita,
                        opcoes: m?.opcoes,
                        cor: m?.cor,
                        acao: (...preEnvio) => mapaFuncoesGerenciar[acao](...parametros, ...preEnvio)
                    })
                    if (m?.tipo == 'criaInput'){
                        elemento.style.height = '100%'
//                        elemento.value = `Administração Geral
//Administração Pública
//Direito Administrativo
//Fluência de dados
//Raciocínio Lógico
//Direito Previdenciário
//Comércio Internacional
//Língua Portuguesa
//Direito Tributário
//Língua Inglesa
//Estatística
//Auditoria
//Contabilidade Geral
//Economia e Finanças
//Direito Constitucional`
                    }
                    if (m?.tipo == 'criaMenuSuspenso') elemento.style.width = '100%'
                }
                
            }
        }

        async function atualizaPagina(){
            window.location.reload()
        }

        // 1º clique: joga a ordem atual (matérias+labels intercalados) no
        // textarea, pra você reorganizar as linhas. 2º clique ("Salvar
        // Ordem"): valida que o conjunto de linhas é exatamente o mesmo de
        // antes (nada a mais, nada a menos, sem repetir) e só salva se
        // bater — senão avisa e não grava nada.
        async function reordenar(seletorInput) {
            let botao = document.getElementById('pulaBlocos_divGerenciar_reordenar')
            let elemento = document.querySelector(seletorInput)
            if (!botao || !elemento) return

            let dados = await obterArmazenamento('pulaBlocos') || {}
            let ordemAtual = dados.ordem?.length
                ? dados.ordem
                : (dados.materias || []).map(m => ({ materia: m.nome, label: null }))

            if (botao.dataset.modo !== 'salvar') {
                elemento.value = ordemAtual.map(o => o.label ? (o.materia + ' / ' + o.label) : o.materia).join('\n')
                botao.textContent = 'Salvar Ordem'
                botao.dataset.modo = 'salvar'
                return
            }

            let conjuntoEsperado = new Set(ordemAtual.map(o => normalizar(o.label ? o.materia + ' / ' + o.label : o.materia)))
            let linhasNovas = elemento.value.split('\n').map(d => d.trim()).filter(Boolean)
            let novaOrdem = linhasNovas.map(linha => {
                let partes = linha.split('/').map(p => p.trim())
                return partes.length > 1 ? { materia: partes[0], label: partes[1] } : { materia: partes[0], label: null }
            })
            let conjuntoNovo = new Set(novaOrdem.map(o => normalizar(o.label ? o.materia + ' / ' + o.label : o.materia)))

            let semRepeticao = conjuntoNovo.size === linhasNovas.length
            let mesmoConjunto = semRepeticao && conjuntoEsperado.size === conjuntoNovo.size &&
                [...conjuntoEsperado].every(item => conjuntoNovo.has(item))

            if (!mesmoConjunto) {
                avisar('ordem inválida — sobrou, faltou ou repetiu algo, nada foi salvo', 'erro')
                relatar('ordem inválida — sobrou, faltou ou repetiu algo, nada foi salvo', linhasNovas, 'vermelho')
                return
            }

            dados.ordem = novaOrdem
            await armazenar({ pulaBlocos: dados })
            elemento.value = ''
            botao.textContent = 'Reordenar'
            botao.dataset.modo = ''
            avisar('ordem salva', 'sucesso')
            relatar('ordem salva', novaOrdem, 'verde')
        }

        async function editarBlocos(selecao){
            let anterior = document.getElementById('pulaBlocos_secao3')
            if (anterior) anterior.remove()

            let dados = await obterArmazenamento('pulaBlocos') || {}
            let materiaNome = (selecao || '').trim()
            let materia = (dados.materias || []).find(d => d.nome == materiaNome)
            if (!materia) return

            let numeroColunas = 2 // muda aqui pra mais colunas, se precisar
            let selecionados = new Map() // chave única → descritor {tipo, label, indice}

            let secao3 = criaDiv({
                id: 'pulaBlocos_secao3',
                ancestral: 'pulaBlocos_divGerenciar_coluna_editar',
                gap: '10px',
                rowColumn: 'column'
            })

            function chave(tipo, nomeLabel, indice) {
                return [tipo, nomeLabel || '__base__', indice].join('::')
            }

            function ligarSelecao(idCheckbox, chaveUnica, descritor) {
                let chk = document.getElementById(idCheckbox)
                if (!chk) return
                chk.addEventListener('click', () => {
                    if (chk.dataset.marcado === '1') selecionados.set(chaveUnica, descritor)
                    else selecionados.delete(chaveUnica)
                })
            }

            // Row com 'numeroColunas' divs-coluna dentro, numeradas de 0 a
            // numeroColunas-1. Cada botão vai pra coluna (indice % numeroColunas).
            function criaGrid(idSufixo) {
                let row = criaDiv({ id: 'pulaBlocos_secao3_grid_' + idSufixo, ancestral: secao3.id, gap: '8px', rowColumn: 'row' })
                let colunas = []
                for (let c = 0; c < numeroColunas; c++) {
                    let coluna = criaDiv({ id: row.id + '_col' + c, ancestral: row.id, gap: '4px', rowColumn: 'column' })
                    coluna.style.flex = '1'
                    coluna.style.minWidth = '0'
                    colunas.push(coluna)
                }
                return colunas
            }

            function renderizarTrilha(trilha, nomeLabel, sufixo) {
                if (trilha.blocos?.length) {
                    let colunas = criaGrid('blocos_' + sufixo)
                    trilha.blocos.forEach((bloco, indice) => {
                        let id = 'pulaBlocos_secao3_bloco_' + sufixo + '_' + indice
                        criaBotaoComCheckbox({
                            id, idCheckbox: id + '_chk',
                            texto: textoFaixa('Bloco', bloco),
                            ancestral: colunas[indice % numeroColunas].id, cor: 'primaria',
                            acao: () => removerUnico('blocos', nomeLabel, indice),
                        })
                        ligarSelecao(id + '_chk', chave('blocos', nomeLabel, indice), { tipo: 'blocos', label: nomeLabel, indice })
                    })
                }
                if (trilha.excluir?.length) {
                    let colunas = criaGrid('excluir_' + sufixo)
                    trilha.excluir.forEach((bloco, indice) => {
                        let id = 'pulaBlocos_secao3_excluir_' + sufixo + '_' + indice
                        criaBotaoComCheckbox({
                            id, idCheckbox: id + '_chk',
                            texto: textoFaixa('Excluir', bloco),
                            ancestral: colunas[indice % numeroColunas].id, cor: 'erro',
                            acao: () => removerUnico('excluir', nomeLabel, indice),
                        })
                        ligarSelecao(id + '_chk', chave('excluir', nomeLabel, indice), { tipo: 'excluir', label: nomeLabel, indice })
                    })
                }
            }

            async function removerUnico(tipo, nomeLabel, indice) {
                let dadosAtuais = await obterArmazenamento('pulaBlocos')
                let materiaAtual = dadosAtuais.materias.find(m => m.nome === materiaNome)
                if (!materiaAtual) return
                let trilha = nomeLabel ? (materiaAtual.labels || []).find(l => l.nome === nomeLabel) : materiaAtual
                if (!trilha?.[tipo]) return
                trilha[tipo].splice(indice, 1)
                await armazenar({ pulaBlocos: dadosAtuais })
                avisar((tipo === 'blocos' ? 'bloco dissolvido' : 'restaurado pra rotação'), 'sucesso')
                await editarBlocos(materiaNome)
            }

            async function removerLabelInteiro(nomeLabel) {
                if (!confirm('Excluir o label "' + nomeLabel + '" inteiro? Os assuntos voltam pra rotação normal da matéria.')) return
                let dadosAtuais = await obterArmazenamento('pulaBlocos')
                let materiaAtual = dadosAtuais.materias.find(m => m.nome === materiaNome)
                if (!materiaAtual) return
                removerLabel(dadosAtuais, materiaAtual, nomeLabel)
                await armazenar({ pulaBlocos: dadosAtuais })
                avisar('label "' + nomeLabel + '" excluído', 'sucesso')
                await editarBlocos(materiaNome)
            }

            async function excluirSelecionados() {
                if (!selecionados.size) return
                let temLabel = [...selecionados.values()].some(d => d.tipo === 'label')
                let mensagem = temLabel
                    ? 'Isso vai excluir ' + selecionados.size + ' item(ns) selecionado(s), incluindo label(s) inteiro(s). Confirma?'
                    : 'Excluir ' + selecionados.size + ' item(ns) selecionado(s)?'
                if (!confirm(mensagem)) return

                let totalSelecionados = selecionados.size
                let dadosAtuais = await obterArmazenamento('pulaBlocos')
                let materiaAtual = dadosAtuais.materias.find(m => m.nome === materiaNome)
                if (!materiaAtual) return

                let porTipo = { blocos: [], excluir: [], label: [] }
                for (let descritor of selecionados.values()) porTipo[descritor.tipo].push(descritor)

                for (let d of porTipo.label) removerLabel(dadosAtuais, materiaAtual, d.label)

                // remove do maior índice pro menor, pra não desalinhar
                // posições durante os splices de um mesmo array
                function removerLote(tipo) {
                    let porTrilha = new Map()
                    for (let d of porTipo[tipo]) {
                        let chaveTrilha = d.label || '__base__'
                        if (!porTrilha.has(chaveTrilha)) porTrilha.set(chaveTrilha, [])
                        porTrilha.get(chaveTrilha).push(d.indice)
                    }
                    for (let [chaveTrilha, indices] of porTrilha) {
                        let trilha = chaveTrilha === '__base__' ? materiaAtual : (materiaAtual.labels || []).find(l => l.nome === chaveTrilha)
                        if (!trilha?.[tipo]) continue
                        indices.sort((a, b) => b - a).forEach(i => trilha[tipo].splice(i, 1))
                    }
                }
                removerLote('blocos')
                removerLote('excluir')

                await armazenar({ pulaBlocos: dadosAtuais })
                avisar(totalSelecionados + ' item(ns) excluído(s)', 'sucesso')
                await editarBlocos(materiaNome)
            }

            renderizarTrilha(materia, null, 'base_' + slug(materia.nome))

            for (let label of materia.labels || []) {
                let idLabel = 'pulaBlocos_secao3_label_' + slug(materia.nome) + '_' + slug(label.nome)
                criaBotaoComCheckbox({
                    id: idLabel, idCheckbox: idLabel + '_chk',
                    texto: 'Label: ' + label.nome,
                    ancestral: secao3.id, cor: '#c98a3e',
                    acao: () => removerLabelInteiro(label.nome),
                })
                ligarSelecao(idLabel + '_chk', chave('label', label.nome, 0), { tipo: 'label', label: label.nome, indice: 0 })
                renderizarTrilha(label, label.nome, slug(materia.nome) + '_' + slug(label.nome))
            }

            criaBotao({
                id: 'pulaBlocos_secao3_excluirSelecionados',
                texto: 'Excluir selecionados',
                cor: 'erro',
                ancestral: secao3.id,
                acao: excluirSelecionados,
            })
        }
        
        async function salvarExcluir(acao, input) {
            let elemento = document.querySelector(input)
            let conteudo = elemento.value
            relatar(conteudo)
            let testadas = conteudo.split('\n').map(d=> d.trim()).filter(d=> /^\d+(\.\d+)*\./.test(d));
            if (testadas.length == 0){
                avisar('nada colado que pareça um assunto (precisa começar com número + ponto)', 'erro')
                return
            }
            relatar('359: ', testadas)
            let dados = await obterArmazenamento('pulaBlocos')
            if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
            let indice = dados.materias.findIndex(d=> normalizar(d.nome) == normalizar(dados?.atual?.materia))
            if (indice < 0) {
                avisar('matéria atual não encontrada em pulaBlocos', 'erro')
                relatar('matéria atual não encontrada em pulaBlocos', dados?.atual, 'vermelho')
                return
            }
            
            let blocos = dados.materias[indice]?.[acao] || []
            blocos.push(testadas)
            dados.materias[indice][acao] = blocos
            //blocos.push(materia.assuntos.filter(d=> d.indice.replace(/\d+\./,'') + ' ' + d.nome == materia.assunto))
            relatar ('362: ', blocos)
            await armazenar({pulaBlocos: dados})
            avisar((acao === 'blocos' ? 'bloco salvo' : 'excluído da rodagem') + ' (' + testadas.length + ' assuntos)', 'sucesso')
            //let materiaAtual = estudadas.findIndex(d => d.nome == materiaAtualNome) || null
            //relatar ('362: ', materia)
            ////let blocos = []
            //for (t of testadas){
            //    relatar('362: ', t)
            //    blocos.push(materia.assuntos.filter(d=> d.indice.replace(/\d+\./,'') + ' ' + d.nome == t))
            //}
            //relatar ('362: ', blocos)
        }
    }
    //let botoes = [
    //    {
    //        id: 'pulaBlocos_botao_1',
    //        texto: '1',
    //        ancestral: 'pulaBlocos_div',
    //        cor: 'primaria',
    //        acao: alert,
    //        parametroAcao: '1'
    //    },
    //    {
    //        id: 'pulaBlocos_botao_2',
    //        texto: '2',
    //        ancestral: 'pulaBlocos_div',
    //        cor: 'primaria',
    //        acao: alert,
    //        parametroAcao: '2'
    //    },
    //    
    //]
    //let larguraCalculo = window.screen.availWidth / botoes.length
    //let largura = larguraCalculo > 250 ? '250px' : larguraCalculo + 'px'
    //relatar(largura, '', 'verde')
    //let i = 0
    //for (b of botoes){
    //    let funcao = botoes[i].acao
    //    let parametro = url[i]
    //    let botao = criaBotao({
    //        id: b?.id,
    //        texto: b?.texto,
    //        ancestral: b?.ancestral,
    //        cor: b?.cor,
    //        acao: () => funcao(parametro),
    //    })
    //    botao.style.width = largura
    //    i++
    //}
    relatar('Gran', '', 'azul')
}

iniciaGran()