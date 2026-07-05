package com.example.mahjongscoregateway;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.DashPathEffect;
import android.graphics.Rect;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.media.Image;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.annotation.NonNull;
import androidx.camera.camera2.interop.Camera2CameraInfo;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.jiangdg.ausbc.MultiCameraClient;
import com.jiangdg.ausbc.callback.ICameraStateCallBack;
import com.jiangdg.ausbc.callback.IDeviceConnectCallBack;
import com.jiangdg.ausbc.callback.IPreviewDataCallBack;
import com.jiangdg.ausbc.camera.bean.CameraRequest;
import com.jiangdg.ausbc.camera.bean.PreviewSize;
import com.jiangdg.ausbc.widget.AspectRatioTextureView;
import com.serenegiant.usb.USBMonitor;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends ComponentActivity {
    private static final int CAMERA_PERMISSION_REQUEST = 1001;
    private static final long OCR_INTERVAL_MS = 1500;
    private static final Pattern POINT_PATTERN = Pattern.compile("\\d{4,6}");

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ExecutorService cameraExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final EditText[] pointInputs = new EditText[4];
    private final EditText[][] regionInputs = new EditText[4][4];
    private final TextRecognizer textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

    private EditText baseUrlInput;
    private EditText deviceIdInput;
    private EditText apiKeyInput;
    private EditText imageUrlInput;
    private TextView statusText;
    private TextView tableText;
    private TextView lastFetchText;
    private TextView lastSendText;
    private TextView pointSummaryText;
    private TextView cameraStatusText;
    private TextView cameraListText;
    private TextView usbCameraListText;
    private TextView ocrResultText;
    private PreviewView previewView;
    private AspectRatioTextureView usbPreviewView;
    private RegionOverlayView regionOverlayView;
    private Button fetchButton;
    private Button sendButton;
    private Button cameraButton;
    private Button cameraSwitchButton;
    private Button usbCameraRefreshButton;
    private Button usbCameraButton;
    private Button imageUrlButton;

    private ProcessCameraProvider cameraProvider;
    private MultiCameraClient usbCameraClient;
    private MultiCameraClient.Camera usbCamera;
    private final List<CameraOption> cameraOptions = new ArrayList<>();
    private final List<UsbDevice> usbCameraDevices = new ArrayList<>();
    private String storeId = "";
    private int tableNumber = 0;
    private int selectedCameraIndex = 0;
    private int selectedUsbCameraIndex = 0;
    private boolean cameraRunning = false;
    private boolean usbCameraRunning = false;
    private boolean imageUrlRunning = false;
    private boolean ocrBusy = false;
    private long lastOcrAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createContentView());
        requestCameraPermissionIfNeeded();
    }

    @Override
    protected void onDestroy() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }
        imageUrlRunning = false;
        stopUsbCamera();
        if (usbCameraClient != null) {
            usbCameraClient.unRegister();
            usbCameraClient.destroy();
            usbCameraClient = null;
        }
        textRecognizer.close();
        cameraExecutor.shutdownNow();
        executor.shutdownNow();
        super.onDestroy();
    }

    private View createContentView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(false);
        scrollView.setVerticalScrollBarEnabled(true);
        scrollView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(96));
        root.setBackgroundColor(Color.rgb(245, 246, 241));
        scrollView.addView(root, new ScrollView.LayoutParams(
            ScrollView.LayoutParams.MATCH_PARENT,
            ScrollView.LayoutParams.WRAP_CONTENT
        ));

        TextView title = new TextView(this);
        title.setText("麻雀卓点数送信");
        title.setTextSize(24);
        title.setTextColor(Color.rgb(27, 34, 31));
        title.setPadding(0, 0, 0, dp(14));
        root.addView(title);

        baseUrlInput = addInput(root, "Web API URL", "http://192.168.2.168:3000", InputType.TYPE_CLASS_TEXT);
        deviceIdInput = addInput(root, "端末ID", "mock-table-1", InputType.TYPE_CLASS_TEXT);
        apiKeyInput = addInput(root, "APIキー 任意", "", InputType.TYPE_CLASS_TEXT);

        fetchButton = addButton(root, "卓情報を取得・更新");
        fetchButton.setOnClickListener(view -> fetchTableInfo());

        tableText = addText(root, "卓情報: 未取得", 16, Color.rgb(27, 34, 31));
        statusText = addText(root, "状態: 待機中", 14, Color.rgb(101, 112, 107));
        lastFetchText = addText(root, "最終取得: -", 13, Color.rgb(101, 112, 107));
        lastSendText = addText(root, "最終送信: -", 13, Color.rgb(101, 112, 107));

        TextView cameraTitle = addText(root, "カメラ読み取り", 18, Color.rgb(27, 34, 31));
        cameraTitle.setPadding(0, dp(18), 0, dp(8));
        cameraListText = addText(root, "検出カメラ: 確認中", 14, Color.rgb(27, 34, 31));
        cameraSwitchButton = addButton(root, "使用カメラを切替");
        cameraSwitchButton.setOnClickListener(view -> switchCamera());
        refreshCameraOptions();

        SquareFrameLayout previewFrame = new SquareFrameLayout(this);
        root.addView(previewFrame, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        previewView = new PreviewView(this);
        previewView.setBackgroundColor(Color.BLACK);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        previewFrame.addView(previewView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        usbPreviewView = new AspectRatioTextureView(this);
        usbPreviewView.setVisibility(View.GONE);
        previewFrame.addView(usbPreviewView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        regionOverlayView = new RegionOverlayView(this);
        previewFrame.addView(regionOverlayView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        cameraButton = addButton(root, "カメラ読み取り開始");
        cameraButton.setOnClickListener(view -> toggleCamera());
        usbCameraListText = addText(root, "USB Webカメラ: 確認中", 14, Color.rgb(27, 34, 31));
        usbCameraRefreshButton = addButton(root, "USB Webカメラを再検出");
        usbCameraRefreshButton.setOnClickListener(view -> refreshUsbCameraDevices());
        usbCameraButton = addButton(root, "USB Webカメラ読み取り開始");
        usbCameraButton.setOnClickListener(view -> toggleUsbCamera());
        imageUrlInput = addInput(root, "USB Camera画像URL 任意", "", InputType.TYPE_CLASS_TEXT);
        imageUrlButton = addButton(root, "画像URLから読み取り開始");
        imageUrlButton.setOnClickListener(view -> toggleImageUrlReading());
        cameraStatusText = addText(root, "カメラ: 停止中", 14, Color.rgb(101, 112, 107));
        ocrResultText = addText(root, "認識結果: -", 14, Color.rgb(27, 34, 31));

        TextView regionTitle = addText(root, "席ごとの認識範囲", 18, Color.rgb(27, 34, 31));
        regionTitle.setPadding(0, dp(18), 0, dp(8));
        addText(root, "正方形に切り取ったカメラ画像上で、中心X/中心Y/幅/高さを%指定します。", 13, Color.rgb(101, 112, 107));
        addRegionInputs(root);

        TextView seatTitle = addText(root, "席1〜4の点数", 18, Color.rgb(27, 34, 31));
        seatTitle.setPadding(0, dp(18), 0, dp(8));

        for (int i = 0; i < pointInputs.length; i += 1) {
            pointInputs[i] = addInput(root, "席" + (i + 1), "25000", InputType.TYPE_CLASS_NUMBER);
            pointInputs[i].addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence text, int start, int count, int after) {
                }

                @Override
                public void onTextChanged(CharSequence text, int start, int before, int count) {
                    updatePointSummary();
                }

                @Override
                public void afterTextChanged(Editable text) {
                }
            });
        }

        pointSummaryText = addText(root, "送信予定: 席1 25000 / 席2 25000 / 席3 25000 / 席4 25000", 14, Color.rgb(27, 34, 31));

        sendButton = addButton(root, "点数を送信して反映");
        sendButton.setOnClickListener(view -> sendPointUpdate());

        return scrollView;
    }

    private EditText addInput(LinearLayout root, String label, String value, int inputType) {
        TextView labelView = addText(root, label, 13, Color.rgb(101, 112, 107));
        labelView.setPadding(0, dp(8), 0, dp(4));

        EditText input = new EditText(this);
        input.setText(value);
        input.setInputType(inputType);
        input.setSingleLine(true);
        input.setTextSize(17);
        input.setPadding(dp(10), 0, dp(10), 0);
        root.addView(input, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(48)
        ));
        return input;
    }

    private Button addButton(LinearLayout root, String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(48)
        );
        params.setMargins(0, dp(14), 0, dp(6));
        root.addView(button, params);
        return button;
    }

    private void addRegionInputs(LinearLayout root) {
        int[][] defaults = {
            {50, 4, 28, 8},
            {96, 50, 8, 28},
            {50, 96, 28, 8},
            {4, 50, 8, 28},
        };

        for (int seatIndex = 0; seatIndex < 4; seatIndex += 1) {
            TextView label = addText(root, "席" + (seatIndex + 1) + " 認識範囲", 13, Color.rgb(101, 112, 107));
            label.setPadding(0, dp(10), 0, dp(4));

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setWeightSum(4);
            root.addView(row, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ));

            String[] labels = {"中心X", "中心Y", "幅", "高さ"};
            for (int fieldIndex = 0; fieldIndex < 4; fieldIndex += 1) {
                LinearLayout cell = new LinearLayout(this);
                cell.setOrientation(LinearLayout.VERTICAL);
                LinearLayout.LayoutParams cellParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                cellParams.setMargins(fieldIndex == 0 ? 0 : dp(6), 0, 0, 0);
                row.addView(cell, cellParams);

                TextView smallLabel = addText(cell, labels[fieldIndex], 11, Color.rgb(101, 112, 107));
                smallLabel.setPadding(0, 0, 0, dp(2));

                EditText input = new EditText(this);
                input.setText(String.valueOf(defaults[seatIndex][fieldIndex]));
                input.setInputType(InputType.TYPE_CLASS_NUMBER);
                input.setSingleLine(true);
                input.setTextSize(14);
                input.setPadding(dp(8), 0, dp(8), 0);
                input.addTextChangedListener(new TextWatcher() {
                    @Override
                    public void beforeTextChanged(CharSequence text, int start, int count, int after) {
                    }

                    @Override
                    public void onTextChanged(CharSequence text, int start, int before, int count) {
                        if (regionOverlayView != null) {
                            regionOverlayView.invalidate();
                        }
                    }

                    @Override
                    public void afterTextChanged(Editable text) {
                    }
                });
                cell.addView(input, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(42)
                ));
                regionInputs[seatIndex][fieldIndex] = input;
            }
        }
    }

    private TextView addText(LinearLayout root, String text, int textSize, int color) {
        TextView textView = new TextView(this);
        textView.setText(text);
        textView.setTextSize(textSize);
        textView.setTextColor(color);
        textView.setPadding(0, dp(4), 0, dp(4));
        root.addView(textView);
        return textView;
    }

    private void refreshCameraOptions() {
        cameraOptions.clear();
        CameraManager cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);

        try {
            for (String cameraId : cameraManager.getCameraIdList()) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(cameraId);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                cameraOptions.add(new CameraOption(cameraId, cameraFacingLabel(facing)));
            }
        } catch (CameraAccessException error) {
            setCameraListText("検出カメラ: 取得できませんでした (" + error.getMessage() + ")");
            return;
        }

        selectedCameraIndex = preferredCameraIndex();
        updateCameraListText();
    }

    private int preferredCameraIndex() {
        int backIndex = -1;
        for (int i = 0; i < cameraOptions.size(); i += 1) {
            CameraOption option = cameraOptions.get(i);
            if (option.label.contains("外部")) {
                return i;
            }
            if (backIndex < 0 && option.label.contains("背面")) {
                backIndex = i;
            }
        }
        return backIndex >= 0 ? backIndex : 0;
    }

    private String cameraFacingLabel(Integer facing) {
        if (facing == null) {
            return "カメラ";
        }
        if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
            return "外部カメラ";
        }
        if (facing == CameraCharacteristics.LENS_FACING_BACK) {
            return "背面カメラ";
        }
        if (facing == CameraCharacteristics.LENS_FACING_FRONT) {
            return "前面カメラ";
        }
        return "カメラ";
    }

    private void switchCamera() {
        if (cameraOptions.isEmpty()) {
            refreshCameraOptions();
            return;
        }

        selectedCameraIndex = (selectedCameraIndex + 1) % cameraOptions.size();
        updateCameraListText();
        boolean wasRunning = cameraRunning;
        if (wasRunning) {
            stopCamera();
            startCamera();
        }
    }

    private CameraSelector selectedCameraSelector() {
        if (cameraOptions.isEmpty()) {
            refreshCameraOptions();
        }
        if (cameraOptions.isEmpty()) {
            return CameraSelector.DEFAULT_BACK_CAMERA;
        }

        String selectedCameraId = cameraOptions.get(selectedCameraIndex).cameraId;
        return new CameraSelector.Builder()
            .addCameraFilter(cameraInfos -> {
                List<CameraInfo> matchedCameras = new ArrayList<>();
                for (CameraInfo cameraInfo : cameraInfos) {
                    try {
                        if (selectedCameraId.equals(Camera2CameraInfo.from(cameraInfo).getCameraId())) {
                            matchedCameras.add(cameraInfo);
                        }
                    } catch (IllegalArgumentException ignored) {
                    }
                }
                return matchedCameras;
            })
            .build();
    }

    private String selectedCameraLabel() {
        if (cameraOptions.isEmpty()) {
            return "標準カメラ";
        }
        CameraOption option = cameraOptions.get(selectedCameraIndex);
        return option.label + " ID:" + option.cameraId;
    }

    private void updateCameraListText() {
        if (cameraOptions.isEmpty()) {
            setCameraListText("検出カメラ: 見つかりません。OTG、USB接続、権限を確認してください。");
            return;
        }

        StringBuilder builder = new StringBuilder("検出カメラ:\n");
        for (int i = 0; i < cameraOptions.size(); i += 1) {
            CameraOption option = cameraOptions.get(i);
            builder.append(i == selectedCameraIndex ? "使用中: " : "候補: ");
            builder.append(option.label).append(" ID:").append(option.cameraId);
            if (i < cameraOptions.size() - 1) {
                builder.append("\n");
            }
        }
        setCameraListText(builder.toString());
    }

    private void setCameraListText(String message) {
        if (cameraListText == null) return;
        mainHandler.post(() -> cameraListText.setText(message));
    }

    private void setupUsbCameraClient() {
        if (usbCameraClient != null) return;

        try {
            usbCameraClient = new MultiCameraClient(this, new IDeviceConnectCallBack() {
                @Override
                public void onAttachDev(UsbDevice device) {
                    refreshUsbCameraDevices();
                    setCameraStatus("USB Webカメラを検出しました。USB Webカメラ読み取り開始を押してください。");
                }

                @Override
                public void onDetachDec(UsbDevice device) {
                    if (usbCamera != null && device != null && usbCamera.getUsbDevice().getDeviceId() == device.getDeviceId()) {
                        stopUsbCamera();
                    }
                    refreshUsbCameraDevices();
                    setCameraStatus("USB Webカメラが外されました。");
                }

                @Override
                public void onConnectDev(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                    if (device == null || ctrlBlock == null) {
                        setCameraStatus("USB Webカメラの接続許可を取得できませんでした。");
                        return;
                    }
                    openUsbCamera(device, ctrlBlock);
                }

                @Override
                public void onDisConnectDec(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
                    stopUsbCamera();
                }

                @Override
                public void onCancelDev(UsbDevice device) {
                    setCameraStatus("USB Webカメラの使用が許可されませんでした。");
                }
            });
            usbCameraClient.register();
        } catch (Throwable error) {
            usbCameraClient = null;
            setUsbCameraListText("USB Webカメラ: 初期化できません。USB Cameraアプリの画像URL連携を使ってください。");
            setCameraStatus("USB Webカメラ初期化エラー: " + readableError(error));
        }
    }

    private void refreshUsbCameraDevices() {
        usbCameraDevices.clear();
        setupUsbCameraClient();
        if (usbCameraClient == null) {
            addUsbManagerCameraDevices();
            updateUsbCameraListText();
            return;
        }

        try {
            List<UsbDevice> devices = usbCameraClient.getDeviceList(null);
            if (devices != null) {
                usbCameraDevices.addAll(devices);
            }
        } catch (Throwable error) {
            setCameraStatus("USB Webカメラ一覧取得エラー: " + readableError(error));
        }
        addUsbManagerCameraDevices();
        if (selectedUsbCameraIndex >= usbCameraDevices.size()) {
            selectedUsbCameraIndex = 0;
        }
        updateUsbCameraListText();
    }

    private void addUsbManagerCameraDevices() {
        UsbManager usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        if (usbManager == null) return;

        Map<String, UsbDevice> deviceList = usbManager.getDeviceList();
        List<UsbDevice> fallbackDevices = new ArrayList<>();
        for (UsbDevice device : deviceList.values()) {
            if (containsUsbDevice(device)) continue;
            if (isLikelyUsbCamera(device)) {
                usbCameraDevices.add(device);
            } else {
                fallbackDevices.add(device);
            }
        }
        if (usbCameraDevices.isEmpty()) {
            usbCameraDevices.addAll(fallbackDevices);
        }
    }

    private boolean containsUsbDevice(UsbDevice candidate) {
        for (UsbDevice device : usbCameraDevices) {
            if (device.getDeviceId() == candidate.getDeviceId()) {
                return true;
            }
        }
        return false;
    }

    private boolean isLikelyUsbCamera(UsbDevice device) {
        if (device.getDeviceClass() == 14) {
            return true;
        }
        for (int i = 0; i < device.getInterfaceCount(); i += 1) {
            UsbInterface usbInterface = device.getInterface(i);
            if (usbInterface.getInterfaceClass() == 14) {
                return true;
            }
        }
        return false;
    }

    private void updateUsbCameraListText() {
        if (usbCameraDevices.isEmpty()) {
            setUsbCameraListText("USB Webカメラ: 見つかりません。接続後に再検出してください。");
            return;
        }

        StringBuilder builder = new StringBuilder("USB Webカメラ:\n");
        for (int i = 0; i < usbCameraDevices.size(); i += 1) {
            UsbDevice device = usbCameraDevices.get(i);
            builder.append(i == selectedUsbCameraIndex ? "使用予定: " : "候補: ");
            builder.append(device.getProductName() != null ? device.getProductName() : device.getDeviceName());
            builder.append(" VID:").append(device.getVendorId());
            builder.append(" PID:").append(device.getProductId());
            if (i < usbCameraDevices.size() - 1) {
                builder.append("\n");
            }
        }
        setUsbCameraListText(builder.toString());
    }

    private void setUsbCameraListText(String message) {
        if (usbCameraListText == null) return;
        mainHandler.post(() -> usbCameraListText.setText(message));
    }

    private void toggleUsbCamera() {
        if (usbCameraRunning) {
            stopUsbCamera();
            return;
        }

        if (cameraRunning) {
            stopCamera();
        }
        if (imageUrlRunning) {
            stopImageUrlReading();
        }

        refreshUsbCameraDevices();
        if (usbCameraDevices.isEmpty()) {
            setCameraStatus("USB Webカメラが見つかりません。接続後に再検出してください。");
            return;
        }

        UsbDevice device = usbCameraDevices.get(selectedUsbCameraIndex);
        setCameraStatus("USB Webカメラの使用許可を待っています。画面に確認が出たら許可してください。");
        try {
            usbCameraClient.requestPermission(device);
        } catch (Throwable error) {
            setCameraStatus("USB Webカメラ開始エラー: " + readableError(error));
        }
    }

    private void openUsbCamera(UsbDevice device, USBMonitor.UsbControlBlock ctrlBlock) {
        try {
            stopUsbCamera();
            previewView.setVisibility(View.GONE);
            usbPreviewView.setVisibility(View.VISIBLE);

            usbCamera = new MultiCameraClient.Camera(this, device);
            usbCamera.setUsbControlBlock(ctrlBlock);
            usbCamera.setCameraStateCallBack(new ICameraStateCallBack() {
                @Override
                public void onCameraState(MultiCameraClient.Camera self, ICameraStateCallBack.State code, String message) {
                    if (code == ICameraStateCallBack.State.OPENED) {
                        usbCameraRunning = true;
                        mainHandler.post(() -> {
                            usbCameraButton.setText("USB Webカメラ読み取り停止");
                            setCameraStatus("USB Webカメラで読み取り中です。");
                        });
                        return;
                    }
                    if (code == ICameraStateCallBack.State.CLOSED) {
                        usbCameraRunning = false;
                        mainHandler.post(() -> usbCameraButton.setText("USB Webカメラ読み取り開始"));
                        return;
                    }
                    setCameraStatus("USB Webカメラ起動失敗: " + (message == null ? "不明なエラー" : message));
                }
            });
            usbCamera.addPreviewDataCallBack(this::analyzeUsbCameraFrame);
            usbCamera.openCamera(usbPreviewView, usbCameraRequest());
        } catch (Throwable error) {
            stopUsbCamera();
            setCameraStatus("USB Webカメラ起動エラー: " + readableError(error));
        }
    }

    private CameraRequest usbCameraRequest() {
        return new CameraRequest.Builder()
            .setPreviewWidth(1280)
            .setPreviewHeight(720)
            .create();
    }

    private void stopUsbCamera() {
        if (usbCamera != null) {
            try {
                usbCamera.closeCamera();
            } catch (Throwable ignored) {
                // Keep the app open even if the USB camera library fails during shutdown.
            }
            usbCamera = null;
        }
        usbCameraRunning = false;
        if (usbCameraButton != null) {
            mainHandler.post(() -> usbCameraButton.setText("USB Webカメラ読み取り開始"));
        }
        if (usbPreviewView != null && previewView != null) {
            mainHandler.post(() -> {
                usbPreviewView.setVisibility(View.GONE);
                previewView.setVisibility(View.VISIBLE);
            });
        }
    }

    private String readableError(Throwable error) {
        if (error == null) return "不明なエラー";
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) {
            return error.getClass().getSimpleName();
        }
        return message;
    }

    private void toggleImageUrlReading() {
        if (imageUrlRunning) {
            stopImageUrlReading();
            return;
        }

        String imageUrl = imageUrlInput.getText().toString().trim();
        if (imageUrl.isEmpty()) {
            setCameraStatus("USB Cameraアプリの画像URLを入力してください。");
            return;
        }
        if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
            setCameraStatus("画像URLは http:// または https:// で入力してください。");
            return;
        }

        if (cameraRunning) {
            stopCamera();
        }

        imageUrlRunning = true;
        imageUrlButton.setText("画像URLから読み取り停止");
        setCameraStatus("画像URLから読み取り中です。");
        fetchImageUrlFrame();
    }

    private void stopImageUrlReading() {
        imageUrlRunning = false;
        ocrBusy = false;
        imageUrlButton.setText("画像URLから読み取り開始");
        setCameraStatus("画像URL読み取りを停止しました。");
    }

    private void fetchImageUrlFrame() {
        if (!imageUrlRunning) return;

        executor.execute(() -> {
            try {
                String imageUrl = imageUrlInput.getText().toString().trim();
                URL url = new URL(imageUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);
                connection.setUseCaches(false);
                Bitmap bitmap = BitmapFactory.decodeStream(connection.getInputStream());
                connection.disconnect();

                if (bitmap == null) {
                    setCameraStatus("画像URLから画像を取得できませんでした。");
                } else {
                    analyzeBitmapFrame(bitmap);
                }
            } catch (Exception error) {
                setCameraStatus("画像URL読み取り失敗: " + error.getMessage());
            } finally {
                mainHandler.postDelayed(this::fetchImageUrlFrame, OCR_INTERVAL_MS);
            }
        });
    }

    private void toggleCamera() {
        if (cameraRunning) {
            stopCamera();
            return;
        }

        if (!hasCameraPermission()) {
            requestCameraPermissionIfNeeded();
            return;
        }

        startCamera();
    }

    private boolean hasCameraPermission() {
        return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestCameraPermissionIfNeeded() {
        if (hasCameraPermission()) {
            setCameraStatus("カメラ権限は許可済みです。");
            return;
        }

        setCameraStatus("カメラ権限を許可してください。");
        requestPermissions(new String[] { Manifest.permission.CAMERA }, CAMERA_PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                setCameraStatus("カメラ権限を許可しました。読み取り開始ボタンを押してください。");
            } else {
                setCameraStatus("カメラ権限が必要です。");
            }
        }
    }

    private void startCamera() {
        if (imageUrlRunning) {
            stopImageUrlReading();
        }
        if (usbCameraRunning) {
            stopUsbCamera();
        }
        previewView.setVisibility(View.VISIBLE);
        usbPreviewView.setVisibility(View.GONE);
        setCameraStatus("カメラを起動中...");
        ListenableFuture<ProcessCameraProvider> providerFuture = ProcessCameraProvider.getInstance(this);
        providerFuture.addListener(() -> {
            try {
                cameraProvider = providerFuture.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build();
                analysis.setAnalyzer(cameraExecutor, this::analyzeCameraFrame);

                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                    this,
                    selectedCameraSelector(),
                    preview,
                    analysis
                );

                cameraRunning = true;
                mainHandler.post(() -> {
                    cameraButton.setText("カメラ読み取り停止");
                    setCameraStatus("読み取り中: " + selectedCameraLabel() + " を使用しています。");
                });
            } catch (Exception error) {
                setCameraStatus("カメラ起動失敗: " + error.getMessage());
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void stopCamera() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }
        cameraRunning = false;
        ocrBusy = false;
        cameraButton.setText("カメラ読み取り開始");
        setCameraStatus("停止中");
    }

    @ExperimentalGetImage
    private void analyzeCameraFrame(ImageProxy imageProxy) {
        long now = System.currentTimeMillis();
        if (ocrBusy || now - lastOcrAt < OCR_INTERVAL_MS) {
            imageProxy.close();
            return;
        }

        Image mediaImage = imageProxy.getImage();
        if (mediaImage == null) {
            imageProxy.close();
            return;
        }

        ocrBusy = true;
        lastOcrAt = now;
        InputImage image = InputImage.fromMediaImage(mediaImage, imageProxy.getImageInfo().getRotationDegrees());
        int imageWidth = imageProxy.getWidth();
        int imageHeight = imageProxy.getHeight();
        int rotationDegrees = imageProxy.getImageInfo().getRotationDegrees();
        if (rotationDegrees == 90 || rotationDegrees == 270) {
            int originalWidth = imageWidth;
            imageWidth = imageHeight;
            imageHeight = originalWidth;
        }
        final int finalImageWidth = imageWidth;
        final int finalImageHeight = imageHeight;

        textRecognizer.process(image)
            .addOnSuccessListener(text -> applyRecognizedText(text, finalImageWidth, finalImageHeight))
            .addOnFailureListener(error -> setCameraStatus("読み取り失敗: " + error.getMessage()))
            .addOnCompleteListener(task -> {
                ocrBusy = false;
                imageProxy.close();
            });
    }

    private void analyzeBitmapFrame(Bitmap bitmap) {
        long now = System.currentTimeMillis();
        if (ocrBusy || now - lastOcrAt < OCR_INTERVAL_MS) {
            return;
        }

        ocrBusy = true;
        lastOcrAt = now;
        int imageWidth = bitmap.getWidth();
        int imageHeight = bitmap.getHeight();
        InputImage image = InputImage.fromBitmap(bitmap, 0);

        textRecognizer.process(image)
            .addOnSuccessListener(text -> applyRecognizedText(text, imageWidth, imageHeight))
            .addOnFailureListener(error -> setCameraStatus("画像URL OCR失敗: " + error.getMessage()))
            .addOnCompleteListener(task -> ocrBusy = false);
    }

    private void analyzeUsbCameraFrame(byte[] data, IPreviewDataCallBack.DataFormat format) {
        long now = System.currentTimeMillis();
        if (data == null || format != IPreviewDataCallBack.DataFormat.NV21 || ocrBusy || now - lastOcrAt < OCR_INTERVAL_MS) {
            return;
        }
        if (usbCamera == null) {
            return;
        }

        PreviewSize previewSize = usbCamera.getPreviewSize();
        int imageWidth = previewSize == null ? 1280 : previewSize.getWidth();
        int imageHeight = previewSize == null ? 720 : previewSize.getHeight();
        if (imageWidth <= 0 || imageHeight <= 0) {
            return;
        }

        ocrBusy = true;
        lastOcrAt = now;
        InputImage image = InputImage.fromByteArray(data, imageWidth, imageHeight, 0, InputImage.IMAGE_FORMAT_NV21);

        textRecognizer.process(image)
            .addOnSuccessListener(text -> applyRecognizedText(text, imageWidth, imageHeight))
            .addOnFailureListener(error -> setCameraStatus("USB WebカメラOCR失敗: " + error.getMessage()))
            .addOnCompleteListener(task -> ocrBusy = false);
    }

    private void applyRecognizedText(Text text, int imageWidth, int imageHeight) {
        List<RecognizedPoint> pointCandidates = extractPointCandidates(text);
        mainHandler.post(() -> {
            if (pointCandidates.isEmpty()) {
                ocrResultText.setText("認識結果: 点数候補なし");
                return;
            }

            Integer[] seatPoints = resolveSeatPoints(pointCandidates, imageWidth, imageHeight);
            ocrResultText.setText("認識結果: " + joinRecognizedPoints(pointCandidates) + "\n範囲別: " + joinSeatPoints(seatPoints));

            int resolvedCount = 0;
            for (int i = 0; i < seatPoints.length; i += 1) {
                if (seatPoints[i] != null) {
                    pointInputs[i].setText(String.valueOf(seatPoints[i]));
                    resolvedCount += 1;
                }
            }

            if (resolvedCount == 4) {
                updatePointSummary();
                setCameraStatus("4席分の点数を認識範囲から反映しました。確認して送信してください。");
            } else {
                setCameraStatus("認識できた席は" + resolvedCount + "席です。範囲か映し方を調整してください。");
            }
        });
    }

    private List<RecognizedPoint> extractPointCandidates(Text text) {
        List<RecognizedPoint> candidates = new ArrayList<>();
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                Rect box = line.getBoundingBox();
                if (box == null) continue;

                String normalizedText = line.getText().replace(",", "").replace(".", "");
                Matcher matcher = POINT_PATTERN.matcher(normalizedText);
                while (matcher.find()) {
                    int value = Integer.parseInt(matcher.group());
                    if (value >= 1000 && value <= 99900) {
                        candidates.add(new RecognizedPoint(value, box.centerX(), box.centerY()));
                    }
                }
            }
        }
        return candidates;
    }

    private Integer[] resolveSeatPoints(List<RecognizedPoint> candidates, int imageWidth, int imageHeight) {
        Integer[] seatPoints = new Integer[4];
        for (RecognizedPoint point : candidates) {
            SquarePoint squarePoint = toCenterSquarePercent(point, imageWidth, imageHeight);
            if (squarePoint == null) continue;

            for (int seatIndex = 0; seatIndex < 4; seatIndex += 1) {
                RegionPercent region = readRegionPercent(seatIndex);
                if (region.contains(squarePoint.xPercent, squarePoint.yPercent) && seatPoints[seatIndex] == null) {
                    seatPoints[seatIndex] = point.value;
                }
            }
        }
        return seatPoints;
    }

    private SquarePoint toCenterSquarePercent(RecognizedPoint point, int imageWidth, int imageHeight) {
        int side = Math.min(imageWidth, imageHeight);
        if (side <= 0) return null;

        int offsetX = (imageWidth - side) / 2;
        int offsetY = (imageHeight - side) / 2;
        if (point.centerX < offsetX || point.centerX > offsetX + side || point.centerY < offsetY || point.centerY > offsetY + side) {
            return null;
        }

        float xPercent = (point.centerX - offsetX) * 100f / side;
        float yPercent = (point.centerY - offsetY) * 100f / side;
        return new SquarePoint(xPercent, yPercent);
    }

    private RegionPercent readRegionPercent(int seatIndex) {
        int centerX = readPercent(regionInputs[seatIndex][0], 50);
        int centerY = readPercent(regionInputs[seatIndex][1], 50);
        int width = readPercent(regionInputs[seatIndex][2], 50);
        int height = readPercent(regionInputs[seatIndex][3], 50);
        return new RegionPercent(centerX, centerY, width, height);
    }

    private int readPercent(EditText input, int fallback) {
        try {
            return clampPercent(Integer.parseInt(input.getText().toString().trim()));
        } catch (NumberFormatException error) {
            return fallback;
        }
    }

    private int clampPercent(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private String joinRecognizedPoints(List<RecognizedPoint> points) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < points.size(); i += 1) {
            if (i > 0) builder.append(" / ");
            RecognizedPoint point = points.get(i);
            builder.append(point.value).append("(").append(point.centerX).append(",").append(point.centerY).append(")");
        }
        return builder.toString();
    }

    private String joinSeatPoints(Integer[] seatPoints) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < seatPoints.length; i += 1) {
            if (i > 0) builder.append(" / ");
            builder.append("席").append(i + 1).append(" ");
            builder.append(seatPoints[i] == null ? "-" : seatPoints[i]);
        }
        return builder.toString();
    }

    private void fetchTableInfo() {
        setButtonsEnabled(false);
        setStatus("卓情報を取得中...");
        executor.execute(() -> {
            try {
                String url = baseUrl() + "/api/android/table?deviceId=" + encode(deviceId());
                JSONObject response = requestJson("GET", url, null);
                JSONObject store = response.getJSONObject("store");
                JSONObject table = response.getJSONObject("table");

                storeId = store.getString("id");
                tableNumber = table.getInt("tableNumber");
                String storeName = store.getString("name");

                if (!response.isNull("activeGame")) {
                    JSONArray seatPoints = response.getJSONObject("activeGame").getJSONArray("seatPoints");
                    for (int i = 0; i < seatPoints.length(); i += 1) {
                        JSONObject seatPoint = seatPoints.getJSONObject(i);
                        int seat = seatPoint.getInt("seat");
                        int points = seatPoint.getInt("points");
                        if (seat >= 1 && seat <= 4) {
                            final int index = seat - 1;
                            mainHandler.post(() -> pointInputs[index].setText(String.valueOf(points)));
                        }
                    }
                } else {
                    mainHandler.post(() -> setStatus("卓情報を取得しました。進行中の対局はありません。"));
                }

                mainHandler.post(() -> {
                    tableText.setText("卓情報: " + storeName + " / " + tableNumber + "卓");
                    lastFetchText.setText("最終取得: " + localTimeNow());
                    updatePointSummary();
                    if (!response.isNull("activeGame")) {
                        setStatus("卓情報を取得しました。席点数を更新しました。");
                    }
                    setButtonsEnabled(true);
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setStatus("取得失敗: " + error.getMessage());
                    setButtonsEnabled(true);
                });
            }
        });
    }

    private void sendPointUpdate() {
        if (storeId.isEmpty() || tableNumber == 0) {
            setStatus("先に卓情報を取得してください。");
            return;
        }

        int[] points = new int[4];
        for (int i = 0; i < pointInputs.length; i += 1) {
            String value = pointInputs[i].getText().toString().trim();
            if (value.isEmpty()) {
                setStatus("席" + (i + 1) + "の点数を入力してください。");
                return;
            }
            try {
                points[i] = Integer.parseInt(value);
            } catch (NumberFormatException error) {
                setStatus("席" + (i + 1) + "の点数は数字で入力してください。");
                return;
            }
        }

        updatePointSummary(points);
        setButtonsEnabled(false);
        setStatus("点数を送信中...");
        executor.execute(() -> {
            try {
                JSONArray pointArray = new JSONArray();
                for (int point : points) {
                    pointArray.put(point);
                }

                JSONObject body = new JSONObject();
                body.put("storeId", storeId);
                body.put("tableNumber", tableNumber);
                body.put("deviceId", deviceId());
                body.put("capturedAt", isoNow());
                body.put("points", pointArray);

                String url = baseUrl() + "/api/android/point-update";
                requestJson("POST", url, body);
                mainHandler.post(() -> {
                    lastSendText.setText("最終送信: " + localTimeNow());
                    setStatus("点数を送信しました。Webダッシュボードへ自動反映されます。");
                    setButtonsEnabled(true);
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setStatus("送信失敗: " + error.getMessage());
                    setButtonsEnabled(true);
                });
            }
        });
    }

    private JSONObject requestJson(String method, String urlText, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlText).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("Accept", "application/json");
        String apiKey = apiKeyInput.getText().toString().trim();
        if (!apiKey.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        }

        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
        }

        int statusCode = connection.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
            statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream(),
            StandardCharsets.UTF_8
        ));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }

        JSONObject json = new JSONObject(response.toString());
        if (statusCode >= 400) {
            throw new IllegalStateException(json.optString("error", "HTTP " + statusCode));
        }
        return json;
    }

    private String baseUrl() {
        return baseUrlInput.getText().toString().trim().replaceAll("/+$", "");
    }

    private String deviceId() {
        return deviceIdInput.getText().toString().trim();
    }

    private String encode(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private String isoNow() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private String localTimeNow() {
        return new SimpleDateFormat("HH:mm:ss", Locale.JAPAN).format(new Date());
    }

    private void setStatus(String message) {
        mainHandler.post(() -> statusText.setText("状態: " + message));
    }

    private void setCameraStatus(String message) {
        mainHandler.post(() -> cameraStatusText.setText("カメラ: " + message));
    }

    private void setButtonsEnabled(boolean enabled) {
        mainHandler.post(() -> {
            fetchButton.setEnabled(enabled);
            sendButton.setEnabled(enabled);
        });
    }

    private void updatePointSummary() {
        if (pointSummaryText == null) return;

        int[] points = new int[4];
        for (int i = 0; i < pointInputs.length; i += 1) {
            try {
                points[i] = Integer.parseInt(pointInputs[i].getText().toString().trim());
            } catch (NumberFormatException error) {
                points[i] = 0;
            }
        }
        updatePointSummary(points);
    }

    private void updatePointSummary(int[] points) {
        if (pointSummaryText == null) return;

        pointSummaryText.setText(
            "送信予定: 席1 " + points[0]
                + " / 席2 " + points[1]
                + " / 席3 " + points[2]
                + " / 席4 " + points[3]
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static class SquareFrameLayout extends FrameLayout {
        SquareFrameLayout(Context context) {
            super(context);
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            int width = MeasureSpec.getSize(widthMeasureSpec);
            int squareSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY);
            super.onMeasure(widthMeasureSpec, squareSpec);
            setMeasuredDimension(width, width);
        }
    }

    private class RegionOverlayView extends View {
        private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint guidePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final int[] colors = {
            Color.rgb(22, 128, 60),
            Color.rgb(15, 118, 110),
            Color.rgb(161, 92, 7),
            Color.rgb(180, 35, 24),
        };

        RegionOverlayView(Context context) {
            super(context);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setStrokeWidth(dp(3));
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setAlpha(38);
            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(dp(15));
            textPaint.setFakeBoldText(true);
            guidePaint.setColor(Color.WHITE);
            guidePaint.setStyle(Paint.Style.STROKE);
            guidePaint.setStrokeWidth(dp(2));
            guidePaint.setPathEffect(new DashPathEffect(new float[] { dp(10), dp(8) }, 0));
            setWillNotDraw(false);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int viewWidth = getWidth();
            int viewHeight = getHeight();
            if (viewWidth <= 0 || viewHeight <= 0) return;

            canvas.drawLine(0, 0, viewWidth, viewHeight, guidePaint);
            canvas.drawLine(viewWidth, 0, 0, viewHeight, guidePaint);

            for (int seatIndex = 0; seatIndex < 4; seatIndex += 1) {
                RegionPercent region = readRegionPercent(seatIndex);
                float left = viewWidth * region.left() / 100f;
                float top = viewHeight * region.top() / 100f;
                float right = viewWidth * region.right() / 100f;
                float bottom = viewHeight * region.bottom() / 100f;
                int color = colors[seatIndex];

                borderPaint.setColor(color);
                fillPaint.setColor(color);
                fillPaint.setAlpha(38);
                canvas.drawRect(left, top, right, bottom, fillPaint);
                canvas.drawRect(left, top, right, bottom, borderPaint);

                float labelX = left + dp(8);
                float labelY = top + dp(22);
                textPaint.setColor(Color.BLACK);
                canvas.drawText("席" + (seatIndex + 1), labelX + 1, labelY + 1, textPaint);
                textPaint.setColor(Color.WHITE);
                canvas.drawText("席" + (seatIndex + 1), labelX, labelY, textPaint);
            }
        }
    }

    private static class RecognizedPoint {
        final int value;
        final int centerX;
        final int centerY;

        RecognizedPoint(int value, int centerX, int centerY) {
            this.value = value;
            this.centerX = centerX;
            this.centerY = centerY;
        }
    }

    private static class CameraOption {
        final String cameraId;
        final String label;

        CameraOption(String cameraId, String label) {
            this.cameraId = cameraId;
            this.label = label;
        }
    }

    private static class SquarePoint {
        final float xPercent;
        final float yPercent;

        SquarePoint(float xPercent, float yPercent) {
            this.xPercent = xPercent;
            this.yPercent = yPercent;
        }
    }

    private static class RegionPercent {
        final int centerX;
        final int centerY;
        final int width;
        final int height;

        RegionPercent(int centerX, int centerY, int width, int height) {
            this.centerX = centerX;
            this.centerY = centerY;
            this.width = width;
            this.height = height;
        }

        boolean contains(float pointX, float pointY) {
            return pointX >= left() && pointX <= right() && pointY >= top() && pointY <= bottom();
        }

        float left() {
            return Math.max(0, centerX - width / 2f);
        }

        float top() {
            return Math.max(0, centerY - height / 2f);
        }

        float right() {
            return Math.min(100, centerX + width / 2f);
        }

        float bottom() {
            return Math.min(100, centerY + height / 2f);
        }
    }
}
