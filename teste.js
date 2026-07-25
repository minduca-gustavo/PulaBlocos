async function teste() {
    let teste = await obterArmazenamento('materias')
    let materias = {materias: teste}
    relatar('teste',materias, 'azul')
    let testarGit = await bFetch('https://minduca-gustavo.github.io/PulaBlocos/materias.json')
    relatar ('testarGit', testarGit, 'vermelho')
    await atualizaBlocos()
}

teste()