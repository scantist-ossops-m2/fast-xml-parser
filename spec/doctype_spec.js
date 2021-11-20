const {XMLParser, XMLValidator} = require("../src/fxp");

describe("XMLParser Entities", function() {

    it("should parse attributes with valid names, default entities", function() {
        const xmlData = `<a:root xmlns:a="urn:none" xmlns:a-b="urn:none">
        <a:a attr="2foo&ampbar&apos;">1</a:a>
        <a:b>2</a:b>
        <a-b:b-a>2</a-b:b-a>
        <a:c>test&amp;\r\nтест&lt;\r\ntest</a:c>
        <a:el><![CDATA[<a>&lt;<a/>&lt;b&gt;2</b>]]]]>\r\n<![CDATA[]]]]><![CDATA[>&amp;]]>a</a:el>
        <c:string lang="ru">\
    &#x441;&#x442;&#x440;&#x430;&#x445;&#x43e;&#x432;&#x430;&#x43d;&#x438;&#x44f;\
    » &#x43e;&#x442; &#x441;&#x443;&#x43c;&#x43c;&#x44b; \
    &#x435;&#x433;&#x43e; &#x430;&#x43a;&#x442;&#x438;&#x432;&#x43e;&#x432;\
    </c:string>
    </a:root>`;

        const expected = {
            "a:root": {
                "@_xmlns:a": "urn:none",
                "@_xmlns:a-b": "urn:none",
                "a:a": {
                    "#text": 1,
                    "@_attr": "2foo&ampbar'"
                },
                "a:b": 2,
                "a-b:b-a": 2,
                "a:c": "test&\nтест<\ntest",
                "a:el": "<a><<a/><b>2</b>]]]]>&a",
                "c:string": {
                    "#text": "&#x441;&#x442;&#x440;&#x430;&#x445;&#x43e;&#x432;&#x430;&#x43d;&#x438;&#x44f;    » &#x43e;&#x442; &#x441;&#x443;&#x43c;&#x43c;&#x44b;     &#x435;&#x433;&#x43e; &#x430;&#x43a;&#x442;&#x438;&#x432;&#x43e;&#x432;",
                    "@_lang": "ru"
                }
            }
        };

        const options = {
            allowBooleanAttributes: true,
            ignoreAttributes:    false,
        };
        const parser = new XMLParser(options);
        let result = parser.parse(xmlData, true);

        //console.log(JSON.stringify(result,null,4));
        expect(result).toEqual(expected);
    });

    it("should parse XML with DOCTYPE without internal DTD", function() {
        const xmlData = "<?xml version='1.0' standalone='no'?><!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\" ><svg><metadata>test</metadata></svg>";
        const expected = {
            "svg" : {
                "metadata": "test"
            }
        };

        const options = {
            allowBooleanAttributes: true,
            ignoreAttributes:    false,
        };
        const parser = new XMLParser(options);
        let result = parser.parse(xmlData, true);

        expect(result).toEqual(expected);
    });

    it("should parse XML with DOCTYPE without internal DTD", function() {
        const xmlData = `<?xml version='1.0' standalone='no'?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >
        <svg>
            <metadata>[test]</metadata>
        </svg>`;
        const expected = {
            "svg" : {
                "metadata": "[test]"
            }
        };

        const options = {
            allowBooleanAttributes: true,
            ignoreAttributes:    false,
        };
        const parser = new XMLParser(options);
        let result = parser.parse(xmlData, true);

        expect(result).toEqual(expected);
    });

    it("should error for when any tag is left to close", function(){
        const xmlData = `<?xml version="1.0"?><!DOCTYPE `;
        expect(() =>{
            const parser = new XMLParser();
            parser.parse(xmlData);
        }).toThrowError("Unclosed DOCTYPE")
    })

    it("should parse XML with DOCTYPE", function() {
        const xmlData = "<?xml version=\"1.0\" standalone=\"yes\" ?>" +
            "<!--open the DOCTYPE declaration -" +
            "  the open square bracket indicates an internal DTD-->" +
            "<!DOCTYPE foo [" +
            "<!--define the internal DTD-->" +
            "<!ELEMENT foo (#PCDATA)>" +
            "<!--close the DOCTYPE declaration-->" +
            "]>" +
            "<foo>Hello World.</foo>";

        const expected = {
            foo: "Hello World."
        };
        
        const options = {

        };
        const parser = new XMLParser(options);
        let result = parser.parse(xmlData);
        //console.log(JSON.stringify(result,null,4));
        expect(result).toEqual(expected);
    });

    it("should parse attributes having '>' in value", function() {
        const xmlData = `
        <?xml version="1.0" encoding="UTF-8"?>

        <!DOCTYPE note [
        <!ENTITY nbsp "&#xA0;">
        <!ENTITY writer "Writer: Donald Duck.">
        <!ENTITY copyright "Copyright: W3Schools.">
        ]>
        
        <note>
            <to>Tove</to>
            <from>Jani</from>
            <heading>Reminder</heading>
            <body attr="&writer;">Don't forget me this weekend!</body>
            <footer>&writer;&nbsp;&copyright;</footer>
        </note> `;

        const expected = {
            "note": {
                "to": "Tove",
                "from": "Jani",
                "heading": "Reminder",
                "body": {
                    "#text": "Don't forget me this weekend!",
                    "attr": "Writer: Donald Duck."
                },
                "footer": "Writer: Donald Duck.&nbsp;Copyright: W3Schools."
            }
        };

        const options = {
            attributeNamePrefix: "",
            ignoreAttributes:    false,
            processEntities: true
        };
        const parser = new XMLParser(options);
        let result = parser.parse(xmlData);
        // console.log(JSON.stringify(result,null,4));

        expect(result).toEqual(expected);
    });
});