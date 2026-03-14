const githubConfig = {
    token: "", 
<<<<<<< HEAD
    owner: "your-github-username", // GANTI dengan username github lo
=======
    owner: "putrakapanlagimxr3", // GANTI dengan username github lo
>>>>>>> 377b2e70430a861112be70a81d3c77b1069c06e0
    repo: "pict-hncute",
    path: "hncute_files",
    adminAvatarPath: "image-admin",
    assetsPath: "assets",
    apiUrl: "/api/gh"
};

window.ghRequest = async function(path, options = {}) {
    const method = options.method || 'GET';
    const url = `/api/gh?path=${path}`;
    
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
<<<<<<< HEAD
};
=======
};
>>>>>>> 377b2e70430a861112be70a81d3c77b1069c06e0
