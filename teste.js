async function teste() {
    let teste = await obterArmazenamento('materias')
    relatar('teste',teste, 'azul')
    let testarGit = await bFetch('https://minduca-gustavo.github.io/PulaBlocos/materias.json')
    relatar ('testarGit', testarGit, 'vermelho')
}

teste()