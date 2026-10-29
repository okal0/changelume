export type Outcome = 'confirmed impact' | 'possible impact' | 'no detected impact within supported analysis' | 'unsupported analysis';
export interface Location {file:string; line:number; symbol:string}
export interface Usage extends Location {kind:'import'|'client'|'call'|'field'|'webhook'|'unsupported'; requestApiVersion?:string; start?:number; end?:number; replacement?:string}
export interface Inventory {vendor:'stripe'; sdkPackage:'stripe'; declared?:string; resolved?:string; versionOrigin:string; usages:Usage[]; limitations:string[]; webhookVersion:string}
export interface Evidence {url:string; sha256:string; origin:'offline snapshot'|'network'|'cache'; release:string}
export interface Finding {outcome:Outcome; location?:Location; explanation:string; changeId:string}
export interface Edit {path:string; beforeHash:string; content:string}
export interface Plan {id:string; revision:string; inventory:Inventory; evidence:Evidence[]; observedReleases:string[]; newlyObserved:string[]; unclassified:string[]; findings:Finding[]; edits:Edit[]; preconditions:string[]; manualSteps:string[]; verification: {command:string;args:string[];timeoutMs:number}[]; acceptedBaseline:unknown; llm:{used:boolean;contextHash?:string};}
export interface Verification {status:'passed'|'failed'|'skipped'; results:{command:string;exitCode:number|null;timedOut:boolean;stdout?:string;stderr?:string;outputTruncated?:boolean}[]}
export interface Bundle {schemaVersion:1; revision:string; plan:Plan; edits:Edit[]; patchHash:string; verification:Verification}
export interface VendorAdapter {id:string; collect(root:string, offline:boolean):Promise<{evidence:Evidence[]; releases:string[]; unclassified:string[]}>}
export interface LanguageAdapter {id:string; inventory(root:string):Inventory}
