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
    criaTitulo({ id: 'pulaBlocos_materiaAtual', texto: 'Matéria atual: —', ancestral: 'pulaBlocos_div_titulo' })
    criaTitulo({ id: 'pulaBlocos_assuntoAtual', texto: 'Assunto atual: —', ancestral: 'pulaBlocos_div_titulo' })
    await atualizarCabecalho()

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
        avancar
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
    function idDaLinha(trilha, linha) {
        let alvo = linha.trim()
        let assuntos = trilha.assuntos || []
        // tenta igual primeiro; se não bater, tira o primeiro segmento do
        // índice (ex.: "48.6.4.2.10." → "6.4.2.10.") — é assim que o índice
        // aparece no site, sem esse prefixo que só existe na árvore da API
        let assunto = assuntos.find(a => (a.indice + ' ' + a.nome) === alvo)
            || assuntos.find(a => (a.indice.replace(/^\d+\./, '') + ' ' + a.nome) === alvo)
        return assunto?.id
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

        let elMateria = document.getElementById('pulaBlocos_materiaAtual')
        let elAssunto = document.getElementById('pulaBlocos_assuntoAtual')
        if (elMateria) elMateria.textContent = 'Matéria atual: ' + nomeMateria
        if (elAssunto) elAssunto.textContent = 'Assunto atual: ' + (assuntoAtual?.nome || '—')
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
    async function avancar(direcao) {
        let {idMateria, blocoArray} = await assuntos(direcao)
        await atualizarCabecalho()
        await navegarParaAssunto(idMateria, blocoArray)
    }

    async function alteraTipo(url, nome, tipoId){
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
                coluna: 'editar',
            },
            {
                tipo: 'criaMenuSuspenso',
                id: 'editarMenu',
                ancestral: '#pulaBlocos_divGerenciar',
                valorInicial: 'Selecione uma matéria.',
                opcoes: opcoes,
                acao: 'editarBlocos',
                coluna: 'editar',
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
            let rc = d?.nome == 'editar' ? 'row' : 'column'
            let coluna = criaDiv({
                id:'pulaBlocos_divGerenciar_coluna_' + d?.nome,
                ancestral:'pulaBlocos_divGerenciar_corpo',
                gap: '4px',
                rowColumn: rc
            })
            coluna.style.width = (larguraCalculo * d?.peso) + '%'
            coluna.style.maxWidth = '600px'
            for (let m of elementosGerenciar){
                if (d?.nome == m?.coluna){
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
                        elemento.value = `Administração Geral
Administração Pública
Direito Administrativo
Fluência de dados
Raciocínio Lógico
Direito Previdenciário
Comércio Internacional
Língua Portuguesa
Direito Tributário
Língua Inglesa
Estatística
Auditoria
Contabilidade Geral
Economia e Finanças
Direito Constitucional`
                    }
                    if (m?.tipo == 'criaMenuSuspenso') elemento.style.width = '100%'
                }
                
            }
        }

        async function atualizaPagina(){
            window.location.reload()
        }

        async function editarBlocos(selecao){
            //relatar('editarBlocos')
            //let elemento = document.querySelector(seletor)
            //relatar(elemento.innerText)
            relatar(selecao)
            let dados = await obterArmazenamento('pulaBlocos') || {}
            if (!dados?.materias) return
            relatar(15)
            let materia = dados?.materias.find(d => d.nome == selecao.trim())
            if (!materia?.blocos && !materia?.excluir) return
            alert('Oi')
        }
        
        async function salvarExcluir(acao, input) {
            let elemento = document.querySelector(input)
            let conteudo = elemento.value
            relatar(conteudo)
            let testadas = conteudo.split('\n').map(d=> d.trim()).filter(d=> /^\d+(\.\d+)*\./.test(d));
            if (testadas.length == 0){
                //rotina retorno
                return
            }
            relatar('359: ', testadas)
            let dados = await obterArmazenamento('pulaBlocos')
            if (typeof dados.atual === 'string') dados.atual = { materia: dados.atual, label: null }
            let indice = dados.materias.findIndex(d=> normalizar(d.nome) == normalizar(dados?.atual?.materia))
            if (indice < 0) {
                relatar('matéria atual não encontrada em pulaBlocos', dados?.atual, 'vermelho')
                return
            }
            
            let blocos = dados.materias[indice]?.[acao] || []
            blocos.push(testadas)
            dados.materias[indice][acao] = blocos
            //blocos.push(materia.assuntos.filter(d=> d.indice.replace(/\d+\./,'') + ' ' + d.nome == materia.assunto))
            relatar ('362: ', blocos)
            await armazenar({pulaBlocos: dados})
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