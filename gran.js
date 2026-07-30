async function iniciaGran() {
    if (!location.origin.includes(PAGINAS.questoes)) return
    let cabecalho = await aguardarElemento('header')
    if (!cabecalho) return
    let divRemove = document.querySelectorAll('[id*="pulaBlocos"]')
    for (d of divRemove){
        d.remove()
    }
    
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
    function idDaLinha(materia, linha) {
        let alvo = linha.trim()
        let assunto = (materia.assuntos || []).find(a => (a.indice + ' ' + a.nome) === alvo)
        return assunto?.id
    }

    function montarUnidades(materia) {
        let excluidos = new Set(
            (materia.excluir || []).flat().map(linha => idDaLinha(materia, linha)).filter(Boolean)
        )
        let inicioDeBloco = new Map() // id do primeiro assunto do bloco → ids do bloco inteiro
        ;(materia.blocos || []).forEach(bloco => {
            let ids = bloco.map(linha => idDaLinha(materia, linha)).filter(Boolean)
            if (ids.length) inicioDeBloco.set(ids[0], ids)
        })

        let unidades = []
        let assuntosOrdenados = materia.assuntos || []
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

    // direcao: 'materia' (pula pra próxima matéria) | 'bloco' (avança
    // dentro da matéria atual) | 'atuais' (fica na mesma unidade, só
    // reconsulta os ids — usado ao trocar de modo sem avançar posição)
    async function assuntos(direcao) {
        let dados = await obterArmazenamento('pulaBlocos')
        if (!dados?.materias?.length) return { idMateria: undefined, blocoArray: [] }

        let indiceMateria = dados.materias.findIndex(m => m.nome === dados.atual)
        if (indiceMateria < 0) indiceMateria = 0

        if (direcao === 'materia') {
            indiceMateria = (indiceMateria + 1) % dados.materias.length
            dados.atual = dados.materias[indiceMateria].nome
        }

        let materia = dados.materias[indiceMateria]
        let unidades = montarUnidades(materia)
        if (!unidades.length) return { idMateria: materia.id, blocoArray: [] }

        let indiceUnidade = unidades.findIndex(u => u.ids.includes(materia.posicaoAtual))
        if (indiceUnidade < 0) indiceUnidade = 0 // nunca andou nessa matéria ainda

        if (direcao === 'bloco') {
            indiceUnidade = (indiceUnidade + 1) % unidades.length
        }

        let unidade = unidades[indiceUnidade]
        materia.posicaoAtual = unidade.ultimoId
        await armazenar({ pulaBlocos: dados })

        relatar('assuntos:', { idMateria: materia.id, blocoArray: unidade.ids }, 'roxo')
        return { idMateria: materia.id, blocoArray: unidade.ids }
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
        let tokenObjeto = {
            id: 'atualizaMaterias',
            acao: 'atualizaMaterias',
            texto: 'Atualiza matérias'
        }
        if (token.length == 0){
            tokenObjeto.id = 'atualizaPagina'
            tokenObjeto.acao = 'atualizaPagina'
            tokenObjeto.texto = 'Atualiza página'
        }
        relatar('174g: ', tokenObjeto)
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
                id: tokenObjeto.id,
                acao: tokenObjeto.acao,
                texto: tokenObjeto.texto,
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
            atualizaMaterias,
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
            let indice = dados.materias.findIndex(d=> normalizar(d.nome) == normalizar(materias?.atual))
            if (indice < 0) {
                relatar('matéria atual não encontrada em pulaBlocos', materias?.atual, 'vermelho')
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