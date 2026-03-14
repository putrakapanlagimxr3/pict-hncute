const githubConfig = {
    token: "", 
    owner: "putrakapanlagimxr3", // GANTI dengan username github lo
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
};
