package com.blariyo.collector.run;

import java.util.Locale;

/** Byte signatures override inaccurate origin headers; full image decoding is a separate check. */
final class SourceImageType {
  private SourceImageType() {}
  static String detect(byte[] bytes,String contentType){
    if(bytes.length>=8&&(bytes[0]&255)==0x89&&bytes[1]==0x50&&bytes[2]==0x4e&&bytes[3]==0x47&&bytes[4]==0x0d&&bytes[5]==0x0a&&bytes[6]==0x1a&&bytes[7]==0x0a)return "image/png";
    if(bytes.length>=3&&(bytes[0]&255)==0xff&&(bytes[1]&255)==0xd8&&(bytes[2]&255)==0xff)return "image/jpeg";
    if(bytes.length>=6&&bytes[0]=='G'&&bytes[1]=='I'&&bytes[2]=='F'&&bytes[3]=='8'&&(bytes[4]=='7'||bytes[4]=='9')&&bytes[5]=='a')return "image/gif";
    if(bytes.length>=12&&bytes[0]=='R'&&bytes[1]=='I'&&bytes[2]=='F'&&bytes[3]=='F'&&bytes[8]=='W'&&bytes[9]=='E'&&bytes[10]=='B'&&bytes[11]=='P')return "image/webp";
    if(bytes.length>=12&&bytes[4]=='f'&&bytes[5]=='t'&&bytes[6]=='y'&&bytes[7]=='p'&&bytes[8]=='a'&&bytes[9]=='v'&&bytes[10]=='i'&&bytes[11]=='f')return "image/avif";
    return contentType==null?"":contentType.split(";",2)[0].strip().toLowerCase(Locale.ROOT);
  }
}
