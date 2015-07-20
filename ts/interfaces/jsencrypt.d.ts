interface JSEncryptInterface {
    new(parameter?: any): JSEncryptInstance;
}

interface JSEncryptInstance {
    getPublicKey(): string;
    getPrivateKey(): string;
    setPublicKey(key: string): any;
    setPrivateKey(key: string): any;
    encrypt(message: string): any;
    decrypt(encryptedMessage: string): any;
}

declare var JSEncrypt: JSEncryptInterface;