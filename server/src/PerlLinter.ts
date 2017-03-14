import * as childProcess from 'child_process';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

export class PerlLinter {
    constructor(private includePath: string[]) { }

    lint(text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        const process: childProcess.ChildProcess = childProcess.spawn('perl', ['-c', '-e', text]);
        process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');

            lines.forEach((line, index) => {
                if(lineStr.indexOf('line') != -1) {
                    
                    const diagnostic: Diagnostic =  Diagnostic.create(Range.create(Position.create(index + 1, 0), Position.create(index + 1, lineStr.length)), lineStr, DiagnosticSeverity.Error);
                    diagnostics.push(diagnostic);
                }    
            });
            
            
            
        });
        process.addListener('exit', function(code: number, signal: string) {
            callback(diagnostics);    
        });
        
    }

   
}