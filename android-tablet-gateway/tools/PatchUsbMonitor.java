import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;

public class PatchUsbMonitor {
    private static final String TARGET = "com/serenegiant/usb/USBMonitor.class";
    private static final String OLD_DESC =
        "(Landroid/content/BroadcastReceiver;Landroid/content/IntentFilter;)Landroid/content/Intent;";
    private static final String NEW_DESC =
        "(Landroid/content/BroadcastReceiver;Landroid/content/IntentFilter;I)Landroid/content/Intent;";

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("usage: PatchUsbMonitor input.jar output.jar");
        }
        Path input = Path.of(args[0]);
        Path output = Path.of(args[1]);
        try (ZipInputStream zipIn = new ZipInputStream(Files.newInputStream(input));
             ZipOutputStream zipOut = new ZipOutputStream(Files.newOutputStream(output))) {
            ZipEntry entry;
            while ((entry = zipIn.getNextEntry()) != null) {
                ZipEntry newEntry = new ZipEntry(entry.getName());
                zipOut.putNextEntry(newEntry);
                byte[] bytes = readAll(zipIn);
                if (TARGET.equals(entry.getName())) {
                    bytes = patchClass(bytes);
                }
                zipOut.write(bytes);
                zipOut.closeEntry();
            }
        }
    }

    private static byte[] patchClass(byte[] bytes) {
        ClassNode classNode = new ClassNode();
        new ClassReader(bytes).accept(classNode, 0);
        boolean patched = false;
        for (MethodNode method : classNode.methods) {
            if (!"register".equals(method.name) || !"()V".equals(method.desc)) {
                continue;
            }
            for (AbstractInsnNode node = method.instructions.getFirst(); node != null; node = node.getNext()) {
                if (!(node instanceof MethodInsnNode methodInsn)) {
                    continue;
                }
                if ("android/content/Context".equals(methodInsn.owner)
                    && "registerReceiver".equals(methodInsn.name)
                    && OLD_DESC.equals(methodInsn.desc)) {
                    method.instructions.insertBefore(methodInsn, new InsnNode(Opcodes.ICONST_4));
                    methodInsn.desc = NEW_DESC;
                    patched = true;
                }
            }
        }
        if (!patched) {
            throw new IllegalStateException("USBMonitor.registerReceiver call was not found");
        }
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        classNode.accept(writer);
        return writer.toByteArray();
    }

    private static byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }
}
