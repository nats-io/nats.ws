export class Lock {
    latch: Promise<any>;
    count: number;
    unlock!: Function;

    constructor(count: number = 1) {
        this.count = count;
        let lock = this;
        this.latch = new Promise((resolve) => {
            this.unlock = function () {
                lock.count -= 1;
                if (lock.count === 0) {
                    resolve();
                }
            }
        });
    }
}