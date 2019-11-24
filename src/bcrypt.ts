// @ts-ignore
import * as native from 'bcryptjs'


export function generateSalt(rounds: number): Promise<string> {
	return new Promise<string>(((resolve, reject) =>
		native.genSalt(rounds, (err: any, result: string) => {
			if (err)
				reject(err)
			else
				resolve(result)
		})))
}

export function hashData(data: any, saltOrRounds: string | number): Promise<string> {
	return new Promise<string>(((resolve, reject) =>
		native.hash(data, saltOrRounds, (err: any, result: string) => {
			if (err)
				reject(err)
			else
				resolve(result)
		})))
}



export function compareHashed(data: any, encrypted: string): Promise<boolean> {
	return new Promise<boolean>(((resolve, reject) =>
		native.compare(data, encrypted, (err: any, result: boolean) => {
			if (err)
				reject(err)
			else
				resolve(result)
		})))
}

