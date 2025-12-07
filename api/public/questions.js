async function addHoney() {
    try {
        const res = await fetch("/api/add-honey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });
        const data = await res.json();
        if (data.ok) {
            return data;
        } else {
            console.error("Error adding honey:", data.message);
        }
    } catch (err) {
        console.error("Error fetching addHoney:", err);
    }
}

async function changeQuestion() {
    try {
        await fetch("/api/change-question", {
            method: "POST",
            credentials: "include"
        });
    } catch (err) {
        console.error("Error fetching changeQuestion: ", err);
    }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let firstTime = true;
let enterPressed = false;

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !enterPressed) {
    enterPressed = true;
    document.querySelector(".submit").click();
  }
});

document.addEventListener("keyup", async (e) => {
  if (e.key === "Enter") {
    enterPressed = false;
  }
});

let todayBefore = 0;
let honeyBefore = 0;

document.addEventListener("DOMContentLoaded", () => {
    async function checkSession() {
        try {
            const res = await fetch("/api/me", { 
                method: "GET",
                credentials: "include" 
            });
            if (!res.ok) throw new Error("not ok");
            const data = await res.json();

            if (data?.ok && data.profile && firstTime) {
                let type = data.profile.actualQuestion.type
                let n1 = data.profile.actualQuestion.n1
                let n2 = data.profile.actualQuestion.n2
                let todayHoney = data.profile.todayHoney
                let myHoney = data.profile.honey

                todayBefore += todayHoney
                honeyBefore += myHoney

                document.querySelector('.honeyTodayText').textContent = `Today: ${todayBefore.toLocaleString('en-US')}`
                document.querySelector('.totalHoneyText').textContent = `${honeyBefore.toLocaleString('en-US')}`
                let operationType;
                if (type == "sum") {
                    operationType = "+"
                } else if (type == "subtraction") {
                    operationType = "-"
                } else if (type == "multiplication") {
                    operationType = "x"
                } else {
                    operationType = "/"
                }
                document.querySelector(".operationText").textContent = `${n1} ${operationType} ${n2}`
                document.querySelector(".questionsContainer").style.display = "flex";

                document.querySelector("#answer").focus();

                firstTime = false;
            } else if (!data?.ok || !data.profile) {
                window.location.href = "/login";
            }
        } catch {
            window.location.href = "/login";
        }
    }

    checkSession();

    setInterval(checkSession, 30_000);

    async function submitClicking() {
        let qBorder = document.querySelector('.qBorder');
        let qContent = document.querySelector('.qContent');
        try {
            const res = await fetch("/api/me", { 
                method: "GET",
                credentials: "include" 
            });
            if (!res.ok) throw new Error("not ok");
            const data = await res.json();

            if (data?.ok && data.profile) {
                let type = data.profile.actualQuestion.type
                let n1 = data.profile.actualQuestion.n1
                let n2 = data.profile.actualQuestion.n2
                let solution;
                if (type == "sum") {
                    solution = n1 + n2
                } else if (type == "subtraction") {
                    solution = n1 - n2
                } else if (type == "multiplication") {
                    solution = n1 * n2
                } else {
                    solution = Math.trunc(n1 / n2)
                }
                let answer = document.querySelector("#answer").value || 0
                if (answer == solution) {
                    const result = await addHoney()
                    let newHoney = result.added;

                    todayBefore += newHoney
                    honeyBefore += newHoney

                    document.querySelector('.honeyTodayText').textContent = `Today: ${todayBefore.toLocaleString('en-US')}`
                    document.querySelector('.totalHoneyText').textContent = `${honeyBefore.toLocaleString('en-US')}`

                    qBorder.style.backgroundColor ="rgb(55, 255, 0)";
                    qContent.style.backgroundColor ="rgb(55, 255, 0)";
                    document.querySelector(".submit").classList.add('continueGood')
                    document.querySelector(".submit").innerHTML = 'Next'

                    document.querySelector("#answer").style.display='none';
                    document.querySelector(".answerData").style.display='flex';
                    

                    if (newHoney == 0) {
                        document.querySelector(".answerData").innerHTML = `
                        <h2>Correct!</h2>
                        `
                    } else {
                        document.querySelector(".answerData").innerHTML = `
                        <h2>Correct!</h2>
                        <h2>+${newHoney} Honey</h2>
                        `
                    }
                } else if (answer != solution) {
                    qBorder.style.backgroundColor ="rgb(255, 0, 0)";
                    qContent.style.backgroundColor ="rgb(255, 0, 0)";
                    document.querySelector(".submit").classList.add('continueWrong')
                    document.querySelector(".submit").innerHTML = 'Next'

                    document.querySelector("#answer").style.display='none';
                    document.querySelector(".answerData").style.display='flex';

                    document.querySelector(".answerData").innerHTML = `
                    <h3>Incorrect</h3>
                    <h3>Your Answer: ${answer}</h3>
                    <h3>Correct Answer: ${solution}</h3>
                    `
                }
                await changeQuestion()

                let submitButton = document.querySelector('.submit')

                async function continueClicking() {
                    if (document.querySelector('.continueGood')) {
                        submitButton.classList.remove('continueGood')
                    } else {
                        submitButton.classList.remove('continueWrong')
                    }
                    qBorder.style.backgroundColor ="#ffbb00";
                    qContent.style.backgroundColor ="#ffbb00";
                    const resNew = await fetch("/api/me", { 
                        method: "GET",
                        credentials: "include" 
                    });
                    if (!resNew.ok) throw new Error("not ok");
                    const dataNew = await resNew.json();

                    if (dataNew?.ok && dataNew.profile) {
                        let type = dataNew.profile.actualQuestion.type
                        let n1 = dataNew.profile.actualQuestion.n1
                        let n2 = dataNew.profile.actualQuestion.n2
                        let operationType;
                        if (type == "sum") {
                            operationType = "+"
                        } else if (type == "subtraction") {
                            operationType = "-"
                        } else if (type == "multiplication") {
                            operationType = "x"
                        } else {
                            operationType = "/"
                        }
                        document.querySelector(".operationText").textContent = `${n1} ${operationType} ${n2}`

                        document.querySelector("#answer").style.display='flex';
                        document.querySelector("#answer").value='';
                        document.querySelector(".answerData").style.display='none';
                        submitButton.innerHTML = 'Submit'
                        document.querySelector("#answer").focus();
                    }

                    submitButton.removeEventListener('click', continueClicking)
                    submitButton.addEventListener('click', submitClicking)
                }

                submitButton.removeEventListener('click', submitClicking)
                submitButton.addEventListener('click', continueClicking)

            } else {
                window.location.href = "/login";
            }
        } catch (e) {
            window.location.href = "/login";
        }
    }

    document.querySelector(".submit").addEventListener('click', submitClicking)
});

document.querySelector('.title').addEventListener('click', () => {
    window.location.href = "./"
    return;
})

document.querySelector('.home').addEventListener('click', () => {
    window.location.href = "./stats"
    return;
})