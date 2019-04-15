package com.mapbox.rctmgl.utils;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.AsyncTask;
import android.util.Log;

import com.mapbox.mapboxsdk.maps.MapboxMap;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Created by nickitaliano on 9/13/17.
 */

public class DownloadMapImageTask extends AsyncTask<Map.Entry<String, String>, Void, List<Map.Entry<String, Bitmap>>> {
    public static final String LOG_TAG = DownloadMapImageTask.class.getSimpleName();

    private Context mContext;
    private MapboxMap mMap;
    private OnAllImagesLoaded mCallback;

    public DownloadMapImageTask(Context context, MapboxMap map, OnAllImagesLoaded callback) {
        mContext = context;
        mMap = map;
        mCallback = callback;
    }

    public interface OnAllImagesLoaded {
        void onAllImagesLoaded();
    }

    @SafeVarargs
    @Override
    protected final List<Map.Entry<String, Bitmap>> doInBackground(Map.Entry<String, String>... objects) {
        List<Map.Entry<String, Bitmap>> images = new ArrayList<>();

        for (Map.Entry<String, String> object : objects) {
            String uri = object.getValue();

            if (uri.contains("://")) { // has scheme attempt to get bitmap from url
                try {
                    Bitmap bitmap = BitmapUtils.getBitmapFromURL(uri, null);
                    images.add(new AbstractMap.SimpleEntry<String, Bitmap>(object.getKey(), bitmap));
                } catch (Exception e) {
                    Log.w(LOG_TAG, e.getLocalizedMessage());
                }
            } else {
                // local asset required from JS require('image.png') or import icon from 'image.png' while in release mode
                Bitmap bitmap = BitmapUtils.getBitmapFromResource(mContext, uri, null);
                images.add(new AbstractMap.SimpleEntry<String, Bitmap>(object.getKey(), bitmap));
            }
        }

        return images;
    }

    @Override
    protected void onPostExecute(List<Map.Entry<String, Bitmap>> images) {
        if (images == null) {
            return;
        }

        for (Map.Entry<String, Bitmap> image : images) {
            mMap.getStyle().addImage(image.getKey(), image.getValue()); // FMTODO 6->7 check
        }

        if (mCallback != null) {
            mCallback.onAllImagesLoaded();
        }
    }
}
