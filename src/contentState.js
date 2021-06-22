import fetch from 'isomorphic-unfetch';

export function contentStateFromLocation() {
    var result = new RegExp("iiif-content=([^&]*)", "i").exec(window.location.search);
    if(!result) return undefined;
    return unescape(result[1]);
}

export async function resolveContentState(contentState) {
    if(!contentState) return Promise.resolve(undefined);
    if(contentState === true) contentState = contentStateFromLocation();
    if(typeof(contentState) == "string"){
        if(contentState.startsWith("http")){
            const response = await fetch(contentState);
            if (response.ok) contentState = await response.json();
            else return Promise.reject({ error: response.statusText, response });
        }
        else if(contentState.startsWith("{")) {
            contentState = JSON.parse(contentState);
        }
        else {
            var s = contentState;
            // Apply url safe base64 replacement, see https://tools.ietf.org/html/rfc4648#section-5
            // this will still work with normal base64. Also remove whitespace. atob can handle whitespace
            // but it would interfere with fixing padding on next line.
            s = s.replaceAll('-','+').replaceAll('_','/').replace(/\s/g,'');
            while((s.length)%4 != 0) s=s+"="; // add padding if it is missing, as it will be with url safe base64
            contentState = JSON.parse(decodeURI(atob(s)));
        }
    }
    if(!contentState) return Promise.resolve(undefined);
    else return Promise.resolve({id: contentState.id, targets: getContentStateTargets(contentState), json: contentState});
}

export function getContentStateTargets(json, base={}){
    if(!json) return [base];
    switch(json.type || json['@type']) {
        case 'Manifest':
        case 'sc:Manifest':
            return [{...base, manifest: json.id || json['@id']}];
        case 'Canvas':
        case 'sc:Canvas':
            const jsonid = json.id || json['@id'];
            if(!jsonid) return [];
            var s = jsonid.split("#");
            if(s.length > 1) {
                base = {...base, canvas: s[0] };
                var m = s[1].match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
                if(m) {
                    var annotationId = s[0] + "_contentState_" + m[1] + "," + m[2] + "," + m[3] + "," + m[4];
                    base = {...base, annotationList: {
                        "@context": "http://www.shared-canvas.org/ns/context.json",
                        "@id": s[0] + "_contentState_annotationList",
                        "@type": "sc:AnnotationList",
                        "resources": [{
                            "@id": annotationId,
                            "@type": "oa:Annotation",
                            "motivation": "oa:commenting",
                            "on": jsonid,
                            "resource": {
                                "@type": "cnt:ContentAsText",
                                "chars": "Link target",
                                "format": "text/plain"
                            }
                        }]
                    }, annotation: annotationId, annotationBox: {x: parseInt(m[1]), y: parseInt(m[2]), w: parseInt(m[3]), h: parseInt(m[4])} };
                } 
            }
            else base = {...base, canvas: jsonid};

            return getContentStateTargets(json.partOf || json.within, base)
        case 'Annotation':
        case 'oa:Annotation':
            if(json.motivation && (json.motivation.includes("highlighting") || json.motivation.includes("contentState")) ){
                if(json.resource && json.resource.chars) base = {...base, annotationResource: json.resource};

                if(json.target instanceof Array) 
                    return json.target.flatMap(x => getContentStateTargets(x, base));
                else
                    return getContentStateTargets(json.target, base);
            }
        default:
            return [base];
    }
}
