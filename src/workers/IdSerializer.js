export default class IdSerializer {

    constructor(typeName) {
        this.typeName = typeName;
    }

    serialize(value) {
        return `${this.typeName}:${value}`;
    }

    parse(text) {
        if (!text.startsWith(this.typeName + ":"))
            return false;

        return text.substring(this.typeName.length + 1);
    }

};
