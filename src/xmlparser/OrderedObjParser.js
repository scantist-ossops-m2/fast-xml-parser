'use strict';

const util = require('../util');
const xmlNode = require('./xmlNode');
const readDocType = require("./DocTypeReader");
const toNumber = require("strnum");

const regx =
  '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|((NAME:)?(NAME))([^>]*)>|((\\/)(NAME)\\s*>))([^<]*)'
  .replace(/NAME/g, util.nameRegexp);

//const tagsRegx = new RegExp("<(\\/?[\\w:\\-\._]+)([^>]*)>(\\s*"+cdataRegx+")*([^<]+)?","g");
//const tagsRegx = new RegExp("<(\\/?)((\\w*:)?([\\w:\\-\._]+))([^>]*)>([^<]*)("+cdataRegx+"([^<]*))*([^<]+)?","g");

class OrderedObjParser{
  constructor(options){
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.docTypeEntities = {};
    this.lastEntities = {
      "amp" : { regex: /&(amp|#38|#x26);/g, val : "&"},
      "apos" : { regex: /&(apos|#39|#x27);/g, val : "'"},
      "gt" : { regex: /&(gt|#62|#x3E);/g, val : ">"},
      "lt" : { regex: /&(lt|#60|#x3C);/g, val : "<"},
      "quot" : { regex: /&(quot|#34|#x22);/g, val : "\""},
    };
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue;
  }

}

/**
 * @param {string} val
 * @param {object} options
 * @param {string} tagName
 * @param {string} jPath
 * @param {boolean} dontTrim
 * @param {boolean} hasAttributes
 * @param {boolean} isLeafNode
 */
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode) {
  if (val !== undefined) {
    if (this.options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if(val.length > 0){
      if(this.options.processEntities) val = this.replaceEntitiesValue(val);
      
      const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
      if(newval === null || newval === undefined){
        //don't parse
        return val;
      }else if(typeof newval !== typeof val || newval !== val){
        //overwrite
        return newval;
      }else if(this.options.trimValues){
        return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
      }else{
        const trimmedVal = val.trim();
        if(trimmedVal === val){
          return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
        }else{
          return val;
        }
      }
    }
  }
}

function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(':');
    const prefix = tagname.charAt(0) === '/' ? '/' : '';
    if (tags[0] === 'xmlns') {
      return '';
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}

//TODO: change regex to capture NS
//const attrsRegx = new RegExp("([\\w\\-\\.\\:]+)\\s*=\\s*(['\"])((.|\n)*?)\\2","gm");
const attrsRegx = new RegExp('([^\\s=]+)\\s*(=\\s*([\'"])([\\s\\S]*?)\\3)?', 'gm');

function buildAttributesMap(attrStr, jPath) {
  if (!this.options.ignoreAttributes && typeof attrStr === 'string') {
    // attrStr = attrStr.replace(/\r?\n/g, ' ');
    //attrStr = attrStr || attrStr.trim();

    const matches = util.getAllMatches(attrStr, attrsRegx);
    const len = matches.length; //don't make it inline
    const attrs = {};
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      let oldVal = matches[i][4];
      const aName = this.options.attributeNamePrefix + attrName;
      if (attrName.length) {
        if (oldVal !== undefined) {
          if (this.options.trimValues) {
            oldVal = oldVal.trim();
          }
          if(this.options.processEntities) oldVal = this.replaceEntitiesValue(oldVal);
          const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
          if(newVal === null || newVal === undefined){
            //don't parse
            attrs[aName] = oldVal;
          }else if(typeof newVal !== typeof oldVal || newVal !== oldVal){
            //overwrite
            attrs[aName] = newVal;
          }else{
            //parse
            attrs[aName] = parseValue(
              oldVal,
              this.options.parseAttributeValue,
              this.options.numberParseOptions
            );
          }
        } else if (this.options.allowBooleanAttributes) {
          attrs[aName] = true;
        }
      }
    }
    if (!Object.keys(attrs).length) {
      return;
    }
    if (this.options.attributesGroupName) {
      const attrCollection = {};
      attrCollection[this.options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}

const parseXml = function(xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n"); //TODO: remove this line
  const xmlObj = new xmlNode('!xml');
  let currentNode = xmlObj;
  let textData = "";
  let jPath = "";
  for(let i=0; i< xmlData.length; i++){//for each char in XML data
    const ch = xmlData[i];
    if(ch === '<'){
      // const nextIndex = i+1;
      // const _2ndChar = xmlData[nextIndex];
      if( xmlData[i+1] === '/') {//Closing Tag
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.")
        let tagName = xmlData.substring(i+2,closeIndex).trim();

        if(this.options.removeNSPrefix){
          const colonIndex = tagName.indexOf(":");
          if(colonIndex !== -1){
            tagName = tagName.substr(colonIndex+1);
          }
        }
        
        if(currentNode){
          textData = this.parseTextData(textData
            , currentNode.tagname
            , jPath
            ,false
            , currentNode.attributes ? Object.keys(currentNode.attributes).length !== 0 : false
            , Object.keys(currentNode.child).length === 0);
          if(textData !== undefined &&  textData !== "") currentNode.add(this.options.textNodeName, textData);
          textData = "";
        }

        if (this.isItStopNode(this.options.stopNodes, currentNode.tagname)) { //TODO: namespace
          const top = this.tagsNodeStack[ this.tagsNodeStack.length - 1];
          const stopNode = top.child[ top.child.length -1 ];
          stopNode[currentNode.tagname] = [ { [this.options.textNodeName] :xmlData.substr(currentNode.startIndex + 1, i - currentNode.startIndex - 1) }];
        }
        
        jPath = jPath.substr(0, jPath.lastIndexOf("."));
        
        currentNode = this.tagsNodeStack.pop();//avoid recurssion, set the parent tag scope
        textData = "";
        i = closeIndex;
      } else if( xmlData[i+1] === '?') {
        i = findClosingIndex(xmlData, "?>", i, "Pi Tag is not closed.")
      } else if(xmlData.substr(i + 1, 3) === '!--') {
        const endIndex = findClosingIndex(xmlData, "-->", i, "Comment is not closed.")
        if(this.options.commentPropName){
          const comment = xmlData.substring(i + 4, endIndex - 2);

          //TODO: remove repeated code
          if(textData){ //store previously collected data as textNode
            textData = this.parseTextData(textData
              , currentNode.tagname
              , jPath
              ,false
              , currentNode.attributes ? Object.keys(currentNode.attributes).length !== 0 : false
              , Object.keys(currentNode.child).length === 0);
  
            if(textData !== undefined &&  textData !== "") currentNode.add(this.options.textNodeName, textData);
            textData = "";
          }
          currentNode.add(this.options.commentPropName, [ { [this.options.textNodeName] : comment } ]);
        }
        i = endIndex;
      } else if( xmlData.substr(i + 1, 2) === '!D') {
        const result = readDocType(xmlData, i);
        this.docTypeEntities = result.entities;
        i = result.i;
      }else if(xmlData.substr(i + 1, 2) === '![') {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9,closeIndex);

        if(textData){ //store previously collected data as textNode
          textData = this.parseTextData(textData
            , currentNode.tagname
            , jPath
            ,false
            , currentNode.attributes ? Object.keys(currentNode.attributes).length !== 0 : false
            , Object.keys(currentNode.child).length === 0);

          if(textData !== undefined &&  textData !== "") currentNode.add(this.options.textNodeName, textData);
          textData = "";
        }

        //cdata should be set even if it is 0 length string
        if(this.options.cdataPropName){
          let val = this.parseTextData(tagExp, this.options.cdataPropName, jPath + "." + this.options.cdataPropName, true, false, true);
          if(!val) val = "";
          currentNode.add(this.options.cdataPropName, [ { [this.options.textNodeName] : val } ]);
        }else{
          let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true);
          if(!val) val = "";
          currentNode.add(this.options.textNodeName, val);
        }
        
        i = closeIndex + 2;
      }else {//Opening tag
        const result = tagExpWithClosingIndex(xmlData, i+1)
        let tagExp = result.data;
        const closeIndex = result.index;
        const separatorIndex = tagExp.search(/\s/);
        let tagName = tagExp;
        let shouldBuildAttributesMap = true;
        if(separatorIndex !== -1){//separate tag name and attributes expression
          tagName = tagExp.substr(0, separatorIndex).replace(/\s\s*$/, '');
          tagExp = tagExp.substr(separatorIndex + 1);
        }

        if(this.options.removeNSPrefix){
          const colonIndex = tagName.indexOf(":");
          if(colonIndex !== -1){
            tagName = tagName.substr(colonIndex+1);
            shouldBuildAttributesMap = tagName !== result.data.substr(colonIndex + 1);
          }
        }
        
        //save text as child node
        if (currentNode && textData) {
          if(currentNode.tagname !== '!xml'){
            //when nested tag is found
            textData = this.parseTextData(textData
              , currentNode.tagname
              , jPath
              , false
              , currentNode.attributes ? Object.keys(currentNode.attributes).length !== 0 : false
              , false);
            if(textData !== undefined &&  textData !== "") currentNode.add(this.options.textNodeName, textData);
            textData = "";
          }
        }

        if(tagName !== xmlObj.tagname){
          jPath += jPath ? "." + tagName : tagName;
        }

  //selfClosing tag
        if(tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1){
          
          if(tagName[tagName.length - 1] === "/"){ //remove trailing '/'
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          }else{
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }

          const childNode = new xmlNode(tagName);
          if(tagName !== tagExp && shouldBuildAttributesMap){
            childNode.attributes = this.buildAttributesMap(tagExp, jPath);
          }
          jPath = jPath.substr(0, jPath.lastIndexOf("."));
          currentNode.addChild(childNode);
        }
  //boolean tags
        else if(this.options.unpairedTags.indexOf(tagName) !== -1){
            // tagExp = tagExp.substr(0, tagExp.length - 1);

          const childNode = new xmlNode(tagName);
          if(tagName !== tagExp && shouldBuildAttributesMap){
            childNode.attributes = this.buildAttributesMap(tagExp, jPath);
          }
          jPath = jPath.substr(0, jPath.lastIndexOf("."));
          currentNode.addChild(childNode);
        }
  //opening tag
        else{
          
          const childNode = new xmlNode( tagName);
          this.tagsNodeStack.push(currentNode);
          
          childNode.startIndex=closeIndex; //for further processing
          
          if(tagName !== tagExp && shouldBuildAttributesMap){
            childNode.attributes = this.buildAttributesMap(tagExp, jPath);
          }
          currentNode.addChild(childNode);
          currentNode = childNode;
        }
        textData = "";
        i = closeIndex;
      }
    }else{
      textData += xmlData[i];
    }
  }
  return xmlObj.child;
}

const replaceEntitiesValue = function(val){
  for(let entityName in this.docTypeEntities){
    const entity = this.docTypeEntities[entityName];
    val = val.replace( entity.regx, entity.val);
  }
  for(let entityName in this.lastEntities){
    const entity = this.lastEntities[entityName];
    val = val.replace( entity.regex, entity.val);
  }
  return val;
}
//TODO: use jPath to simplify the logic
/**
 * 
 * @param {string[]} stopNodes 
 * @param {string} currentTagName 
 */
function isItStopNode(stopNodes, currentTagName){
  const matchingStopNodes = [];
  //filter the list of stopNodes as per current tag
  stopNodes.forEach( jPath => {
    if( jPath.substr( jPath.length - currentTagName.length) === currentTagName) matchingStopNodes.push(jPath);
  });

  if(matchingStopNodes.length > 0){
    let jPath = "";
    for (let i = 1; i < this.tagsNodeStack.length; i++) {
      const node = this.tagsNodeStack[i];
      jPath += "." + node.tagname;
    }
    jPath += "." + currentTagName;
    jPath = jPath.substr(1);
    for (let i = 0; i < matchingStopNodes.length; i++) {
      if(matchingStopNodes[i] === jPath) return true;
    }
  }else return false;
}

/**
 * Returns the tag Expression and where it is ending handling single-dobule quotes situation
 * @param {string} xmlData 
 * @param {number} i starting index
 * @returns 
 */
function tagExpWithClosingIndex(xmlData, i){
  let attrBoundary;
  let tagExp = "";
  for (let index = i; index < xmlData.length; index++) {
    let ch = xmlData[index];
    if (attrBoundary) {
        if (ch === attrBoundary) attrBoundary = "";//reset
    } else if (ch === '"' || ch === "'") {
        attrBoundary = ch;
    } else if (ch === '>') {
        return {
          data: tagExp,
          index: index
        }
    } else if (ch === '\t') {
      ch = " "
    }
    tagExp += ch;
  }
}

function findClosingIndex(xmlData, str, i, errMsg){
  const closingIndex = xmlData.indexOf(str, i);
  if(closingIndex === -1){
    throw new Error(errMsg)
  }else{
    return closingIndex + str.length - 1;
  }
}


function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === 'string') {
    //console.log(options)
    const newval = val.trim();
    if(newval === 'true' ) return true;
    else if(newval === 'false' ) return false;
    else return toNumber(val, options);
  } else {
    if (util.isExist(val)) {
      return val;
    } else {
      return '';
    }
  }
}


module.exports = OrderedObjParser;
