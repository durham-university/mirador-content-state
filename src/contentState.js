export function contentStateFromLocation() {
    var result = new RegExp("iiif-content=([^&]*)", "i").exec(window.location.search);
    if(!result) return undefined;
    return unescape(result[1]);
}

export function parseContentState(contentState) {
    if(!contentState) return undefined;
    else if(typeof(contentState) == "string"){
        if(contentState.startsWith("http")){
            return {reference: true, id: contentState, json: {id: contentState}};
        }
        else if(contentState.startsWith("{")) {
            return parseContentState(JSON.parse(contentState));
        }
        else {
            var s = contentState;
            // Apply url safe base64 replacement, see https://tools.ietf.org/html/rfc4648#section-5
            // this will still work with normal base64. Also remove whitespace. atob can handle whitespace
            // but it would interfere with fixing padding on next line.
            s = s.replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,'');
            while((s.length)%4 != 0) s=s+"="; // add padding if it is missing, as it will be with url safe base64
            s = atob(s);
            s = decodeURIComponent(escape(s)); // this effectively goes from UTF8 to javascript string
            return parseContentState(s);          
        }
    }
    else{
        return {reference: !contentState.type, id: contentState.id, json: contentState};
    }
}

export function getContentStateManifest(json){
    if(!json) return undefined;
    switch(json.type) {
        case 'Manifest':
            return json.id;
        case 'Canvas':
            return getContentStateManifest(json.partOf || json.within);
        case 'Annotation':
            return getContentStateManifest(json.target);
        default:
            return undefined;
    }
}

export function getContentStateCanvas(json){
    if(!json) return undefined;
    switch(json.type) {
        case 'Canvas':
            if(!json.id) return undefined;
            var s = json.id.split("#");
            if(s.length > 1) return s[0];
            else return json.id;
        case 'Annotation':
            if(json.motivation && (json.motivation.includes("highlighting") || json.motivation.includes("contentState")) )
                return getContentStateCanvas(json.target);
            else return undefined;
        default:
            return undefined;
    }      
}

export function getContentStateCollection(json){
    if(!json) return undefined;
    switch(json.type) {
        case 'Manifest':
            return getContentStateCollection(json.partOf || json.within);
        case 'Canvas':
            return getContentStateCollection(json.partOf || json.within);
        case 'Annotation':
            if(json.motivation && (json.motivation.includes("highlighting") || json.motivation.includes("contentState")) )
                return getContentStateCollection(json.target);
            else return undefined;
        default:
            return undefined;
    }
}

export function getContentStateBox(json){
    if(!json) return undefined;
    switch(json.type) {
        case 'Canvas':
            if(!json.id) return undefined;
            var s = json.id.split("#");
            if(s.length <= 0) return undefined;
            var m = s[1].match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
            if(!m) return undefined;
            return {x: parseInt(m[1]), y: parseInt(m[2]), w: parseInt(m[3]), h: parseInt(m[4])};
        case 'Annotation':
            if(json.motivation && (json.motivation.includes("highlighting") || json.motivation.includes("contentState")) ) {
                return getContentStateBox(json.target);
            }
            else return undefined;
        default:
            return undefined;
    }      
}

export function getContentStateAnnotation(json){
    if(!json) return undefined;
    switch(json.type) {
        case 'Canvas':
            if(!json.id) return undefined;
            var s = json.id.split("#");
            if(s.length > 1) {
                var m = s[1].match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
                if(!m) return undefined
                var path = "M" + m[1] + "," + m[2] + "l" + m[3] + ",0l0," + m[4] + "l-" + m[3] + ",0z";
                return {
                    "@context": "http://www.shared-canvas.org/ns/context.json",
                    "@id": s[0] + "_contentState_annotationList",
                    "@type": "sc:AnnotationList",
                    "resources": [{
                        "@id": s[0] + "_contentState_" + m[1] + "," + m[2] + "," + m[3] + "," + m[4],
                        "@type": "oa:Annotation",
                        "motivation": "oa:commenting",
                        "on": json.id,
                        "resource": {
                            "@type": "cnt:ContentAsText",
                            "chars": "Link target",
                            "format": "text/plain"
                        }
                    }]
                };
                /*return { 
                    "@context": "http://iiif.io/api/presentation/3/context.json",
                    "@id": s[0] + "_contentState_annotationPage",
                    "type": "AnnotationPage",
                    "items": [{
                        "@context": "http://iiif.io/api/presentation/2/context.json",
                        "@id": s[0] + "_contentState_" + m[1] + "," + m[2] + "," + m[3] + "," + m[4],
                        "@type": "oa:Annotation",
                        "label": "",
                        "motivation": "sc:painting",
                        "on": [{
                            "@type": "oa:SpecificResource",
                            "full": s[0],
                            "selector": {
                                "@type": "oa:Choice",
                                "default": {
                                    "@type": "oa:FragmentSelector",
                                    "value": s[1]
                                },
                                "item": {
                                    "@type": "oa:SvgSelector",
                                    "value": "<svg xmlns='http://www.w3.org/2000/svg'><path xmlns=\"http://www.w3.org/2000/svg\" d=\"" + path +"\" data-paper-data=\"{\u0026quot;strokeWidth\u0026quot;:4,\u0026quot;rotation\u0026quot;:0,\u0026quot;deleteIcon\u0026quot;:null,\u0026quot;rotationIcon\u0026quot;:null,\u0026quot;group\u0026quot;:null,\u0026quot;editable\u0026quot;:false,\u0026quot;annotation\u0026quot;:null}\" id=\"rectangle_content_state\" fill-opacity=\"0\" stroke=\"#ff3d16\" stroke-width=\"4\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" stroke-dasharray=\"20 20\"/></svg>"
                                }
                            }
                        }]
                    }]
                };*/
            }
            else return undefined;
        case 'Annotation':
//            return json;
            if(json.motivation && (json.motivation.includes("highlighting") || json.motivation.includes("contentState")) ) {
                var annotation = getContentStateAnnotation(json.target);
                if(annotation && json.resource && json.resource.chars) {
                    return {...annotation, "resources": [{...(annotation.resources[0]), "resource": {
                        "@type": "cnt:ContentAsText",
                        "chars": json.resource.chars,
                        "format": "text/plain"
                      }
                    }]};
                }
                else return annotation;
            }
        default:
            return undefined;
    }  
}
