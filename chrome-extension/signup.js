const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");

const showSignup = document.getElementById("show-signup");
const showSignin = document.getElementById("show-signin");

const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");

const logoutBtn = document.getElementById("logout");
const formTitle = document.getElementById("form-title");

/* ===============================
   SWITCH FORMS
================================= */

showSignup.addEventListener("click", () => {
  signinForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  formTitle.innerText = "Sign Up";
});

showSignin.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  signinForm.classList.remove("hidden");
  formTitle.innerText = "Sign In";
});

/* ===============================
   SIGN UP (Backend Connected)
================================= */

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-confirm").value;

  if (password !== confirm) {
    alert("Passwords do not match!");
    return;
  }

  try {
    const response = await fetch("http://localhost:5001/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      alert("Account created successfully!");
      signupForm.reset();
      showSignin.click();
    } else {
      alert(data.message);
    }

  } catch (error) {
    alert("Server error. Make sure backend is running.");
  }
});

/* ===============================
   SIGN IN (Backend Connected)
================================= */

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  try {
    const response = await fetch("http://localhost:5001/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
    chrome.storage.local.set({ learnlensUserId: data.userId }, () => {
        console.log("UserId saved to chrome.storage.local");
        });
    
    chrome.storage.local.get("learnlensUserId", (result) => {
        console.log("UserId in notes panel:", result.learnlensUserId);
    });
    
      showMain();
    } else {
      alert(data.message);
    }

  } catch (error) {
    alert("Server error. Make sure backend is running.");
  }
});

/* ===============================
   LOGOUT
================================= */

logoutBtn.addEventListener("click", () => {

  chrome.storage.local.remove("learnlensUserId", () => {
    console.log("User logged out");
  });

  showAuth();
});

/* ===============================
   UI FUNCTIONS
================================= */

function showMain() {
  authSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
}

function showAuth() {
  authSection.classList.remove("hidden");
  mainSection.classList.add("hidden");
}

/* ===============================
   CHECK LOGIN ON LOAD
================================= */



chrome.storage.local.get("learnlensUserId", (result) => {

  if (result.learnlensUserId) {
    console.log("User already logged in");
    showMain();
  } else {
    console.log("User not logged in");
    showAuth();
  }

});