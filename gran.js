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
    let larguraCalculo = window.screen.availWidth / [Object.entries(PAGINAS.tiposDeBotoes)].length
    let largura = larguraCalculo > 185 ? '185px' : larguraCalculo + 'px'
    let modoArmazenado = await obterArmazenamento('materiasEstudadas') || {}
    let modo = modoArmazenado.atual?.modo || 'facilCertoErrado'
    relatar('modo', modo, 'roxo')
    let mapaFuncoes = {
        gerenciar,
        alteraTipo,
        assuntos
    }
    for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
        //console.log(nomeTipo, dados)
        let tipoId = 'pulaBlocos_' + nomeTipo
        let [funcao, parametros] = ['', {}]
        let cor = modo == nomeTipo ? '#d62839' : 'primaria'
        if (dados?.url){
            funcao = alteraTipo
            parametros = [dados?.url, nomeTipo, tipoId]
        } else if (dados?.materiaOuAssunto) {
            funcao = assuntos
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
        t++
    }

    async function assuntos(materiaAssuntoAtuais) {
        let valores = {
            materia: {
                somaMateria: 1,
                somaAssunto: 0
            },
            assunto: {
                somaMateria: 0,
                somaAssunto: 1
            },
            atuais: {
                somaMateria: 0,
                somaAssunto: 0
            }
        }
        let{idMateria, idAssunto} = await defineIdAssuntos(valores[materiaAssuntoAtuais].somaMateria, valores[materiaAssuntoAtuais].somaAssunto)
        let blocoArray = []
        blocoArray.push(idAssunto)
        relatar(idMateria)
        relatar(idAssunto)
        relatar('blocoArray', blocoArray, 'roxo')
        return {idMateria: idMateria, blocoArray: blocoArray}
    }
    
    async function defineIdAssuntos(somaMateria = 0, somaAssunto = 0) {
        let materiasEstudadas = await obterArmazenamento('materiasEstudadas') || {}
        let materias = await obterArmazenamento('materias') || []
        let materiaAtualNome = materiasEstudadas?.atual?.materia || ''
        let materiaAtualIndex = materias.findIndex(d => d.nome == materiaAtualNome) || null
        if (materiaAtualIndex < 0) materiaAtualIndex = 0
        let indiceMateriaGarantido = materias?.length <= materiaAtualIndex + somaMateria ? 0 : materiaAtualIndex + somaMateria
        let assuntoAtualNome = (materiasEstudadas?.materias.find(d=> d?.nome == materiaAtualNome)).assunto || ''
        let assuntoAtualIndex = materias[indiceMateriaGarantido]?.assuntos.findIndex(d => d?.indice.replace(/^\d+\./, "") + ' ' + d?.nome == assuntoAtualNome) || 0
        if (assuntoAtualIndex < 0) assuntoAtualIndex = 0
        let indiceAssuntoGarantido = materias[indiceMateriaGarantido]?.assuntos?.length <= assuntoAtualIndex + somaAssunto ? 0 : assuntoAtualIndex + somaAssunto
        return {idMateria: materias[indiceMateriaGarantido]?.id, idAssunto: materias[indiceMateriaGarantido]?.assuntos[indiceAssuntoGarantido]?.id}
    }

    async function alteraTipo(url, nome, tipoId){
        let materiasEstudadas = await obterArmazenamento('materiasEstudadas')
        let materias = await obterArmazenamento('materias')
        materiasEstudadas.atual.modo = nome
        let {idMateria, blocoArray} = await assuntos('atuais')
        relatar ('85: ', JSON.stringify(blocoArray), 'verde')
        for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
            
            let tipoId = '#pulaBlocos_' + nomeTipo
            let botao = document.querySelector(tipoId)
            let corResolver = ''
            if (dados?.url){
                if (nomeTipo == nome ){
                    corResolver = '#d62839'
                } else {
                    corResolver = 'primaria'
                }
                let { cor: corBase, corHover, texto: corTexto } = _ui_resolveCor(corResolver)
                botao.style.background = corBase
                _ui_hoverBotao(botao, corBase, corHover)
            }
        }
        await armazenar({materiasEstudadas: materiasEstudadas})
        let urlNavegar = url + '&assunto=' + idMateria + '%2C' + blocoArray.join('%2C')
        await navegar(urlNavegar, {novaAba: false})
        relatar('materiasEstudadas', materiasEstudadas, 'azul')
        relatar('materias', materias, 'azul')
        relatar('url', url, 'azul')
        relatar('urlNavegar', urlNavegar, 'azul')
        relatar('tipoId', tipoId, 'azul')
        //materiasEstudadas?.atual?.modo = 
        relatar('materiasEstudadas', materiasEstudadas, 'roxo')

    }

    async function gerenciar() {
        let divAnterior = document.querySelector('#pulaBlocos_divGerenciar')
        if (divAnterior) {
            divAnterior.remove()
            return
        }
        let divGerenciar = criaDiv({
            id: 'pulaBlocos_divGerenciar',
            ancestral: '.questoes-navbar',
            gap: '4px'
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
                tipo: 'criaTitulo',
                id: 'tituloBlocos',
                ancestral: 'pulaBlocos_divGerenciar',
                texto: 'Cria blocos',
                coluna: 1,
            },
            {
                tipo: 'criaTexto',
                id: 'tituloBlocos',
                ancestral: 'pulaBlocos_divGerenciar',
                texto: 'Copie e cole os assuntos para criar blocos.',
                coluna: 1,
            },
            {
                tipo: 'criaInput',
                id: 'inputSalvar',
                ancestral: 'pulaBlocos_divGerenciar',
                placeholder: 'Cole aqui + enter ou clique no botão para montar blocos.',
                acao: 'salvarExcluir',
                parametros: ['salvar', '#pulaBlocos_gerenciar_inputSalvar'],
                coluna: 1
            },
            {
                tipo: 'criaBotao',
                id: 'inputBotao',
                ancestral: 'pulaBlocos_divGerenciar',
                acao: 'salvarExcluir',
                texto: 'Salvar como bloco',
                parametros: ['salvar', '#pulaBlocos_gerenciar_inputSalvar'],
                coluna: 1
            },
            {
                tipo: 'criaTitulo',
                id: 'tituloBlocos',
                ancestral: 'pulaBlocos_divGerenciar',
                texto: 'Exclui assuntos',
                coluna: 2,
            },
            {
                tipo: 'criaTexto',
                id: 'tituloBlocos',
                ancestral: 'pulaBlocos_divGerenciar',
                texto: 'Copie e cole os assuntos que devem ser excluídos, ou seja, não "rodarão".',
                coluna: 2,
            },
            {
                tipo: 'criaInput',
                id: 'inputExcluir',
                ancestral: 'pulaBlocos_divGerenciar',
                placeholder: 'Cole aqui + enter ou clique no botão para excluir assuntos.',
                acao: 'salvarExcluir',
                parametros: ['excluir', '#pulaBlocos_gerenciar_inputExcluir'],
                coluna: 2
            },
            {
                tipo: 'criaBotao',
                id: 'inputBotao',
                ancestral: 'pulaBlocos_divGerenciar',
                acao: 'salvarExcluir',
                texto: 'Excluir assuntos',
                parametros: ['excluir', '#pulaBlocos_gerenciar_inputExcluir'],
                coluna: 2
            },
            {
                tipo: 'criaTitulo',
                id: 'tituloBlocos',
                ancestral: 'pulaBlocos_divGerenciar',
                texto: 'Apagar Filtros',
                coluna: 3,
            },

        ]
        let mapaFuncoesGerenciar = {
            criaTitulo,
            criaTexto,
            criaInput,
            criaBotao,
            criaBotaoComCheckbox,
            salvarExcluir,
            alert,
        }

        let colunas = Math.max(...secoesGerenciar.map(d=> d.coluna))
        let larguraCalculo = window.screen.availWidth / colunas
        let largura = larguraCalculo > 600 ? '600px' : larguraCalculo + 'px'
        //let colunasNumero = Math.max(colunas)
        relatar ('colunas', colunas)
        for (let i = 1; i <= colunas; i++){
            let coluna = criaDiv({
                id:'pulaBlocos_gerenciar_coluna' + i,
                ancestral:'pulaBlocos_divGerenciar',
                gap: '4px',
                rowColumn: 'column'
            })
            coluna.style.width = largura
            for (let m of secoesGerenciar){
                if (m?.coluna == i){
                    let acao = m?.acao
                    let parametros = m?.parametros || []
                    let funcao = m?.tipo
                    let elemento = mapaFuncoesGerenciar[funcao]({
                        texto: m?.texto,
                        id: 'pulaBlocos_gerenciar_' + m?.id,
                        ancestral: 'pulaBlocos_gerenciar_coluna' + i,
                        placeholder: m?.placeholder,
                        acao: () => mapaFuncoesGerenciar[acao](...parametros)
                    })
                }
            }
        }

        
        async function salvarExcluir(acao, input) {
            let elemento = document.querySelector(input)
            let resultado = elemento.value
            
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