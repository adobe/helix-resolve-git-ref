import { Request,  Response, Fastly, Headers } from "@fastly/as-compute";

// The name of a backend server associated with this service.
//
// This should be changed to match the name of your own backend. See the the
// `Hosts` section of the Fastly Wasm service UI for more information.
const BACKEND_NAME = "backend_name";

/// The name of a second backend associated with this service.
const OTHER_BACKEND_NAME = "other_backend_name";

function getQueryParam(qs: string, param: string): string {
    const pairs = qs.split("&");
    for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].indexOf(param + "=")==0) {
            return pairs[i].substr(param.length + 1);
        }
    }
    return "";
}

function getQueryString(path: string):string {
    if (path.indexOf("?") > 0) {
        return path.substring(path.indexOf("?") + 1);
    }
    return "";
}

// The entry point for your application.
//
// Use this function to define your main request handling logic. It could be
// used to route based on the request properties (such as method or path), send
// the request to a backend, make completely new requests, and/or generate
// synthetic responses.
function main(req: Request): Response {
    // Make any desired changes to the client request.
    req.headers().set("Host", "example.com");

    // We can filter requests that have unexpected methods.
    const VALID_METHODS = ["HEAD", "GET", "POST"];
    if (!VALID_METHODS.includes(req.method())) {
        return new Response(String.UTF8.encode("This method is not allowed"), {
            status: 405,
        });
    }

    let method = req.method();
    let urlParts = req.url().split("//").pop().split("/");
    let host = urlParts.shift();
    let path = ("/" + urlParts.join("/"));
    let qs = getQueryString(path);

    const owner = getQueryParam(qs, "owner");
    const repo = getQueryParam(qs, "repo"); 
    let ref = getQueryParam(qs, "ref");
    let sha = "";

    if (owner != "" && repo != "" && true) {
        let cacheOverride = new Fastly.CacheOverride();
        cacheOverride.setTTL(60);

        const myreq = new Request("https://github.com/" + owner + "/" + repo + ".git/info/refs?service=git-upload-pack", {});

        const myresp = Fastly.fetch(myreq, {
            backend: "GitHub",
            cacheOverride,
        }).wait();

        const lines = myresp.text().split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (ref == "" && lines[i].indexOf("symref=HEAD:") > 0) {
                let refline = lines[i].substr(lines[i].indexOf("symref=HEAD:") + 23);
                ref = refline.substr(0, refline.indexOf(" "));
            }
            if (ref != "" && sha == "" && lines[i].indexOf(" refs/heads/" + ref) > 0) {
                sha = lines[i].substr(0, lines[i].indexOf(" refs/heads/" + ref));
                ref = "refs/heads/" + ref;
            }
            if (ref != "" && sha == "" && lines[i].indexOf(" refs/tags/" + ref) > 0) {
                sha = lines[i].substr(0, lines[i].indexOf(" refs/tags/" + ref));
                ref = "refs/tags/" + ref;
            }
        }

        const myheaders = new Headers();
        myheaders.set("Content-Type", "application/json");

        return new Response(String.UTF8.encode('{ "fqRef": "' + ref + '", "sha": "' + sha + '"  }'), {
            status: 200,
            headers: myheaders
          });
    }

    return new Response(String.UTF8.encode('Specify owner and repo, please.'), {
        status: 400
    });
}

// Get the request from the client.
let req = Fastly.getClientRequest();

// Pass the request to the main request handler function.
let resp = main(req);

// Send the response back to the client.
Fastly.respondWith(resp);
