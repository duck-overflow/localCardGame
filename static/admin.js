var socket = io();

socket.on("update_admin_panel", function (data) {
    let userList = document.getElementById("userList");
    let userCount = document.getElementById("userCount");

    userCount.innerHTML = data.users.length + " / " + data.max_users;
    userList.innerHTML = "";

    data.users.forEach(user => {
        let userDiv = document.createElement("div");
        userDiv.className = "user";
        userDiv.id = "userFormat";
        userDiv.innerHTML = `<p>${user}</p>`;
        userList.appendChild(userDiv);
    });
});

socket.on("update_user_list", function (data) {

    let usersList = document.getElementById("alluserList");

    usersList.innerHTML = "";

    data.users.forEach(user => {
        let userDiv = document.createElement("div");
        userDiv.className = "users";
        userDiv.id = "userFormat";
        userDiv.innerHTML = `<p>${user}</p>`;
        usersList.append(userDiv);
    });

});