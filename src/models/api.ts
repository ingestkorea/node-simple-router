export type Success<T> = { ok: true } & T;
export type Fail = { ok: false; message: string };

export type Result<T> = Success<T> | Fail;
