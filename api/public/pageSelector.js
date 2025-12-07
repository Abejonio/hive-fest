document.querySelectorAll('.title').forEach(title => {
    title.addEventListener('click', () => {
        window.location.href = "./"
        return;
    })
})

document.querySelectorAll('.stats').forEach(stats => {
    stats.addEventListener('click', () => {
        window.location.href = "./stats"
        return;
    })
})

document.querySelectorAll('.leaderboard').forEach(lb => {
    lb.addEventListener('click', () => {
        window.location.href = "./leaderboard"
        return;
    })
})

document.querySelectorAll('.market').forEach(lb => {
    lb.addEventListener('click', () => {
        window.location.href = "./market"
        return;
    })
})

document.querySelectorAll('.getHoney').forEach(questions => {
    questions.addEventListener('click', () => {
        window.location.href = "./questions"
        return;
    })
})

document.querySelector('.svgDiv').addEventListener('click', () => {
    let rightBar = document.querySelector('.pageSelectorRight')
    rightBar.style.marginLeft = 'calc(100% - min(210px, 42vw, 42vh))'
    let blackbg = document.querySelector('.graybg')
    blackbg.style.display = 'flex'
    document.querySelector('.quitRight').addEventListener('click', () => {
        rightBar.style.marginLeft = '100%'
        blackbg.style.display = 'none'
    })
    blackbg.addEventListener('click', () => {
        rightBar.style.marginLeft = '100%'
        blackbg.style.display = 'none'
    })
})

async function doLogout() {
    try {
        const res = await fetch("/api/logout", { 
            method: "POST",
            credentials: "include"
        });
        await res.json().catch(() => ({}));
    } catch {}
    window.location.href = "/login";
}

document.querySelector('.log-out').addEventListener("click", (e) => {
    e.preventDefault();
    doLogout();
});